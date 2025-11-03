# Stitch UI Pattern - Pet Selector UX Implementation Plan

**Date**: 2025-11-02
**Task**: Complete redesign of product page pet/font selector to match Stitch pattern
**Target**: Mobile-first (70% traffic) Shopify e-commerce for personalized pet products
**Status**: Implementation plan - DO NOT CODE, only provide specifications

---

## Executive Summary

This plan provides comprehensive UX specifications for redesigning `ks-product-pet-selector.liquid` and `pet-font-selector.liquid` to adopt the cleaner, more intuitive Stitch UI pattern. The design prioritizes mobile experience, reduces cognitive load, and streamlines the purchase flow while maintaining support for 1-10 pets per product (metafield-driven).

**Key UX Principles Applied**:
- Progressive disclosure (show only what's needed)
- Mobile-first design (44px touch targets, thumb-zone optimization)
- Clear visual hierarchy (count → details → style → font)
- Global selections for style/font (reduce per-pet complexity)
- Accessibility compliance (WCAG 2.1 AA minimum)

---

## Table of Contents

1. [Design Answers to User Questions](#1-design-answers-to-user-questions)
2. [Component Architecture](#2-component-architecture)
3. [Layout Specifications](#3-layout-specifications)
4. [Interaction Patterns](#4-interaction-patterns)
5. [Mobile vs Desktop Considerations](#5-mobile-vs-desktop-considerations)
6. [HTML/Liquid Structure](#6-htmlliquid-structure)
7. [Visual Design Specifications](#7-visual-design-specifications)
8. [Error & Validation States](#8-error--validation-states)
9. [Accessibility Requirements](#9-accessibility-requirements)
10. [Performance Optimization](#10-performance-optimization)
11. [Priority & Implementation Order](#11-priority--implementation-order)
12. [Edge Cases & Solutions](#12-edge-cases--solutions)
13. [Success Metrics](#13-success-metrics)

---

## 1. Design Answers to User Questions

### Q1: Pet Count Selector UX (1-10 pets)

**RECOMMENDED APPROACH: Hybrid Scrollable Button Row**

**Mobile (1-10 pets)**:
- Horizontal scrollable row of buttons (like iOS segmented control)
- Show 3-4 buttons visible at once, swipe to see more
- Scroll indicators (fade edges) to signal more options
- Active button: Solid fill, Inactive: Outline only
- Button size: 60px x 44px (WCAG compliant touch target)
- Spacing: 8px gap between buttons

**Desktop (1-10 pets)**:
- Same horizontal row, but all buttons visible (no scroll)
- Compact layout: 50px x 40px per button
- Spacing: 12px gap between buttons

**Visual Example**:
```
Mobile View (swipeable):
┌─────────────────────────────┐
│ [1] [2] [3] [4] → fade edge │ (swipe for 5-10)
└─────────────────────────────┘

Desktop View (all visible):
┌─────────────────────────────────────────────────┐
│ [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]       │
└─────────────────────────────────────────────────┘
```

**Why this approach**:
- Maintains Stitch's visual simplicity (buttons not dropdown)
- Scalable to 10 without overwhelming UI
- Familiar mobile pattern (horizontal scroll)
- No "show more" interaction needed
- Touch-friendly spacing

**Alternative Rejected**:
- ❌ Dropdown: Hides options, extra tap required
- ❌ 2-row grid: Takes vertical space on mobile
- ❌ Stepper (+/-): Slow for jumping 1→10

---

### Q2: Per-Pet Section Design (5+ pets)

**RECOMMENDED APPROACH: Accordion with Smart Defaults**

**Mobile Experience**:
- Accordion sections (one open at a time)
- Auto-expand current pet, collapse others
- Pet 1 expanded by default
- Completion indicator on collapsed headers (✅ icon)
- Section header shows: "Pet 2: Lucy" (name updates live)
- Height: Variable based on content (~200px per section)

**Desktop Experience**:
- All sections visible at once (no accordion)
- Stacked vertical layout with clear dividers
- Sticky section headers during scroll
- Max 3 pets visible in viewport, scroll for more

**Section Header States**:
1. **Empty**: "Pet 1" (gray text) + Expand arrow
2. **In Progress**: "Pet 1: Buddy" (black text) + Upload icon
3. **Complete**: "Pet 1: Buddy" (black text) + ✅ Green checkmark

**Mobile Layout**:
```
┌─────────────────────────────────┐
│ Pet 1: Buddy            ✅ ▼   │ ← Expanded
│ ┌─────────────────────────────┐ │
│ │ Name: [Buddy           ]    │ │
│ │ Upload: [Choose File]  [📷] │ │
│ │ ☐ Use Existing Perkie Print │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Pet 2: Lucy             ✅ ▶   │ ← Collapsed
├─────────────────────────────────┤
│ Pet 3                      ▶   │ ← Collapsed
└─────────────────────────────────┘
```

**Why accordion for mobile**:
- Reduces scrolling (only show active pet)
- Focuses attention (one task at a time)
- Industry standard for multi-step forms
- Easy to implement with native `<details>` element

**Why NOT accordion on desktop**:
- More screen space available
- Users expect overview of all inputs
- Faster data entry (no click to expand)

---

### Q3: Style Selection (4 effects, no upload yet)

**RECOMMENDED APPROACH: Static Preview Images + Overlay Text**

**Card Design**:
- 4 visual cards in 2x2 grid (mobile) or 1x4 row (desktop)
- Static example pet images showing each effect style
- Card size (mobile): ~155px x 140px
- Card size (desktop): ~180px x 160px
- Selected state: 3px green border + checkmark overlay

**Preview Image Strategy**:
```
Use generic pet example photos (NOT customer's pet)
- B&W: Golden retriever in black & white effect
- Color: Same golden retriever in color effect
- Modern (Ink Wash): Same pet in ink wash style
- Sketch (Pen & Marker): Same pet in sketch style
```

**Card Layout**:
```
┌──────────────────────┐
│   [Example Image]    │ ← 80% of card height
│   showing effect     │
├──────────────────────┤
│    Black & White     │ ← Label (20% of card)
└──────────────────────┘
```

**Why static previews**:
- No upload required to show styles
- Instant understanding (visual > text)
- Reduces Gemini API quota waste
- Industry standard (all competitors use this)

**Image Requirements**:
- Create 4 example images (one pet, 4 effects)
- Use popular breed (Golden Retriever or Lab)
- Clean white background
- Portrait orientation (head/neck only)
- Optimized for mobile: ~50KB each WebP

**Selected State Visual**:
```
┌──────────────────────┐
│   [Example Image]    │
│         ✅           │ ← Checkmark overlay (top-right)
├──────────────────────┤
│  ● Black & White     │ ← Radio dot + Bold text
└──────────────────────┘
   ▲ Green border (3px)
```

---

### Q4: Font Selection (6 fonts)

**RECOMMENDED APPROACH: 3x2 Grid (Mobile) + Dynamic Preview**

**Mobile Layout**:
- 3 columns x 2 rows grid
- Card size: ~100px x 90px (tight but WCAG compliant)
- Font name preview IN the font (like Stitch)
- Pet names comma-separated in preview

**Desktop Layout**:
- 6 columns x 1 row (all visible)
- Card size: ~140px x 100px

**Font Preview with 5+ Pet Names**:
```
Mobile Strategy:
1-3 names: Full names ("Buddy, Lucy, Max")
4-5 names: Truncate last name ("Buddy, Lucy, Max, Char...")
6+ names: Show count ("Buddy, Lucy, +4 more")

Desktop Strategy:
1-5 names: Full names
6+ names: Show first 5 + count ("Buddy, Lucy, Max, Charlie, Daisy, +2 more")
```

**Card Design**:
```
┌──────────────┐
│   PREPPY     │ ← Label (small, top)
│              │
│ Buddy, Lucy  │ ← Live preview in font
│              │
└──────────────┘
```

**6 Fonts Layout** (Mobile 3x2):
```
┌───────┬───────┬───────┐
│Preppy │Classic│Playful│
├───────┼───────┼───────┤
│Elegant│ Trend │ Blank │
└───────┴───────┴───────┘
```

**Why 3x2 grid**:
- Maintains WCAG 44px minimum touch target
- All fonts visible without scroll
- Balanced use of screen space
- Clear visual comparison

**Font Preview Updates**:
- Live update as user types pet names
- Debounced (300ms) to avoid lag
- Graceful fallback if font fails to load

---

### Q5: "Use Existing Perkie Print" Feature

**RECOMMENDED APPROACH: Expandable Checkbox with Inline Input**

**Collapsed State** (Default):
```
☐ Use Existing Perkie Print
```

**Expanded State** (When checked):
```
☑ Use Existing Perkie Print
┌─────────────────────────────────────┐
│ Previous Order Number               │
│ [#________]                         │
│ Found in your order confirmation    │
└─────────────────────────────────────┘
```

**Placement**:
- INSIDE each per-pet section (not global)
- Positioned BELOW upload buttons
- Above name input

**Interaction Flow**:
1. User checks box → Input field slides down (200ms)
2. User enters order number → Real-time validation
3. Valid format → Show loading spinner
4. API lookup → Fetch previous order pet image
5. Success → Replace upload buttons with preview thumbnail
6. Failure → Show inline error message

**Validation Rules**:
- Format: `#` + 4-6 digits (e.g., #1001, #123456)
- Real-time: Check format as user types
- On blur: API call to validate order number exists
- Error messages: Inline below input (red text)

**Error States**:
```
❌ "Order #1001 not found. Please check your email."
❌ "Order #1001 has no pet images. Upload a new photo."
❌ "Invalid format. Use #1001 (found in order email)."
```

**Success State**:
```
✅ Order #1001 found!
┌─────────────────┐
│  [Pet Image]    │ ← Thumbnail from previous order
│  From Order     │
│  #1001          │
└─────────────────┘
[Change] button
```

**Why inline expansion**:
- Reduces initial cognitive load (hidden until needed)
- Clear cause-effect (check box → see input)
- Consistent with per-pet data model
- Familiar pattern (address forms, promo codes)

---

### Q6: Visual Hierarchy & Section Order

**RECOMMENDED ORDER** (Matches Stitch + Purchase Flow Logic):

```
1. Number of Pets        ← Global setting (affects everything below)
   [1] [2] [3] ... [10]

2. Your Pet's Details    ← Per-pet data collection
   ┌─ Pet 1 (Accordion) ─────────────┐
   │ Name: [_________]                │
   │ Upload: [Choose] or ☐ Use #1001 │
   └──────────────────────────────────┘
   ┌─ Pet 2 (Accordion) ─────────────┐
   │ ...                              │
   └──────────────────────────────────┘

3. Choose Style          ← Global selection (all pets)
   [B&W] [Color] [Modern] [Sketch]

4. Choose Font           ← Global selection (all pets)
   [Preppy] [Classic] ... [Blank]

5. Add to Cart           ← Final action
   [Add to Cart - $XX.XX]
```

**Why this order**:
1. **Pet count first**: Determines how many sections appear
2. **Pet details second**: Collect individual data before styling
3. **Style third**: Apply artistic effect (shows all pet names in preview)
4. **Font fourth**: Final personalization (shows all pet names)
5. **Add to cart last**: Complete data, clear price

**Visual Spacing**:
- Between sections: 24px (mobile), 32px (desktop)
- Inside sections: 16px (mobile), 20px (desktop)
- Section dividers: 1px solid #e0e0e0

**Section Headers**:
- Font size: 18px (mobile), 20px (desktop)
- Font weight: 600 (semibold)
- Color: #1a1a1a (dark gray)
- Margin bottom: 12px

---

### Q7: Mobile Optimization (70% of traffic)

**CRITICAL MOBILE-FIRST DECISIONS**:

#### Touch Target Sizes (WCAG 2.5.5 Compliance)
```
Minimum: 44px x 44px (iOS/Android standard)
Recommended: 48px x 48px (better for aging users)

Applied to:
- Pet count buttons: 60px x 44px ✅
- Style cards: 155px x 140px ✅
- Font cards: 100px x 90px ✅
- Upload buttons: Full width x 48px ✅
- Checkboxes: 24px x 24px + 20px padding = 44px ✅
```

#### Thumb-Zone Optimization
```
Mobile Screen Zones (Right-Handed):
┌─────────────────────────┐
│      Hard to Reach      │ ← Avoid critical actions
├─────────────────────────┤
│                         │
│    Easy to Reach        │ ← Primary actions here
│    (Thumb Zone)         │
│                         │
├─────────────────────────┤
│   Medium Difficulty     │ ← Secondary actions
└─────────────────────────┘

Placement Strategy:
- Add to Cart button: Bottom (thumb zone) ✅
- Pet count selector: Top (less critical) ✅
- Upload buttons: Middle (important, reachable) ✅
- Style/Font cards: Middle-bottom (engagement zone) ✅
```

#### Scrolling Behavior
```
Mobile: Vertical scroll only (no horizontal except pet count)
- Accordion keeps content above fold
- Sticky "Add to Cart" button (bottom of viewport)
- Scroll progress indicator (1/4, 2/4, 3/4, 4/4 complete)

Estimated Total Height:
- Pet count: 80px
- 3 pet sections (accordion): ~600px (200px each)
- Style selection: 320px (2x2 grid)
- Font selection: 220px (3x2 grid)
- Add to cart: 60px
Total: ~1,280px (2-3 scrolls on average phone)
```

#### Form Input Optimization
```
Pet Name Input:
- Type: text
- Autocapitalize: words (capitalizes first letter)
- Autocomplete: off (prevent autofill confusion)
- Inputmode: text (standard keyboard)
- Pattern: [A-Za-z0-9, \-']+ (alphanumeric + comma/dash/apostrophe)

Order Number Input:
- Type: text (NOT number, to allow # character)
- Inputmode: numeric (shows number keyboard)
- Pattern: [#]?[0-9]+ (optional # + digits)
- Autocomplete: off
```

#### Mobile-Specific Interactions
```
Upload Button Behavior:
- Single tap: Opens native file picker
- Shows camera option if device has camera
- Allows "Take Photo" or "Choose from Library"
- Max file size: 50MB (communicated BEFORE upload)

Style/Font Selection:
- Single tap to select (no hover state)
- Visual feedback: 100ms scale animation (0.95x)
- Haptic feedback on iOS (if supported)
- Clear selected state (thick border + checkmark)
```

---

### Q8: Add to Cart Integration

**VALIDATION REQUIREMENTS** (All must pass before enabling "Add to Cart"):

```
Required Fields Checklist:
┌────────────────────────────────────────┐
│ ☑ Pet count selected (1-10)            │
│ ☑ All pet names provided               │
│ ☑ All pet images uploaded/selected     │
│ ☑ Style selected (B&W/Color/Modern/Sketch) │
│ ☑ Font selected (if product has text)  │
└────────────────────────────────────────┘
```

**Add to Cart Button States**:

**1. Disabled (Default)**:
```
┌─────────────────────────────┐
│  Add to Cart - $XX.XX       │ ← Gray background, low opacity
│  ⚠️ Complete all fields above │ ← Help text below
└─────────────────────────────┘
```

**2. Enabled (All valid)**:
```
┌─────────────────────────────┐
│  Add to Cart - $XX.XX       │ ← Green background, full opacity
└─────────────────────────────┘
```

**3. Processing (Click → API call)**:
```
┌─────────────────────────────┐
│  ⏳ Adding to Cart...        │ ← Spinner animation
└─────────────────────────────┘
```

**4. Error State**:
```
┌─────────────────────────────┐
│  ❌ Failed - Try Again       │ ← Red background
└─────────────────────────────┘
(Error message above button)
```

**Validation Timing**:
- **Real-time**: Validate as user completes each section
- **On blur**: Validate pet names and order numbers
- **Before cart**: Final validation on button click
- **Debounced**: 500ms delay for name inputs (avoid lag)

**Visual Progress Indicator**:
```
┌─────────────────────────────┐
│ ●●●○ 3 of 4 steps complete  │ ← Sticky header
└─────────────────────────────┘

Steps:
1. Pet details (name + image)
2. Style selection
3. Font selection
4. Add to cart
```

**Error Message Patterns**:
```
Field-Level Errors (Inline):
❌ "Please enter a pet name"
❌ "Please upload a photo or enter order #"
❌ "Order #1001 not found"

Form-Level Errors (Top of page):
⚠️ "Complete all pet details before adding to cart"
⚠️ "Select a style for your pet portraits"
```

**Price Calculation** (Dynamic):
```
Single Pet:
Base Price: $29.99
Custom Fee: $0 (FREE)
Total: $29.99

Multiple Pets (if applicable):
Base Price: $29.99
Custom Fee: $10 × 2 pets = $20
Total: $49.99

Displayed As:
┌─────────────────────────────┐
│ Product: $29.99             │
│ Custom Fee: +$20 (2 pets)   │
│ ─────────────────────────   │
│ Total: $49.99               │
└─────────────────────────────┘
```

**Why this approach**:
- Clear requirements (users know what's missing)
- Real-time feedback (no surprise errors)
- Accessible (screen readers announce state)
- Standard e-commerce pattern (builds trust)

---

## 2. Component Architecture

### Component Hierarchy

```
ks-product-pet-selector.liquid (Main Container)
├── Pet Count Selector
│   └── Horizontal scrollable button row
├── Pet Details Section (Dynamic 1-10)
│   ├── Accordion Item (Mobile) / Stacked Card (Desktop)
│   │   ├── Pet Name Input
│   │   ├── Upload Button + File Input
│   │   ├── "Use Existing Perkie Print" Checkbox
│   │   └── Order Number Input (Conditional)
│   └── Repeat for each pet (1 to max_pets)
├── Style Selector (Global)
│   └── 4 Visual Cards (B&W, Color, Modern, Sketch)
└── Font Selector (Global) - pet-font-selector.liquid
    └── 6 Font Cards (Preppy, Classic, Playful, Elegant, Trend, Blank)
```

### Data Flow

```
User Input → Validation → State Update → UI Update → Cart Preparation

1. Pet Count Change:
   User clicks [3] → Update petCount state → Show/hide pet sections (1-3 visible)

2. Pet Name Input:
   User types "Buddy" → Validate (alphanumeric) → Update preview in font cards
   → Display "Buddy, Lucy, Max" in all font previews

3. Image Upload:
   User clicks Upload → File picker → Validate (size/type) → Upload to server
   → Store GCS URL → Show thumbnail → Mark section complete ✅

4. Style Selection:
   User taps "Modern" → Update selectedStyle → Highlight card → Enable "Add to Cart"
   (if all other fields valid)

5. Font Selection:
   User taps "Preppy" → Update selectedFont → Highlight card → Enable "Add to Cart"

6. Add to Cart:
   User clicks "Add to Cart" → Final validation → Build cart object:
   {
     petNames: ["Buddy", "Lucy", "Max"],
     petImages: ["https://...", "https://...", "https://..."],
     selectedStyle: "modern",
     selectedFont: "preppy",
     artistNotes: ["Note 1", "", "Note 3"],
     previousOrderNumbers: ["", "#1001", ""]
   }
   → Add to Shopify cart → Redirect to cart page
```

### State Management

**Global State** (JavaScript object):
```javascript
window.petSelectorState = {
  sectionId: "template-123",
  productId: 8765432198765,
  maxPets: 3, // From product metafield

  // User selections
  petCount: 1,
  pets: [
    {
      id: "pet_1",
      name: "Buddy",
      imageSource: "upload", // "upload" | "previous_order"
      imageUrl: "https://storage.googleapis.com/...",
      previousOrderNumber: "",
      artistNote: "",
      isComplete: true
    }
  ],
  selectedStyle: "modern", // Global
  selectedFont: "preppy",  // Global

  // Validation
  isValid: false,
  errors: [],

  // UI state
  activeAccordion: "pet_1",
  isSubmitting: false
};
```

**Why centralized state**:
- Single source of truth
- Easy debugging (inspect `window.petSelectorState`)
- Simplifies validation
- Enables undo/redo (future feature)
- Better testing

---

## 3. Layout Specifications

### Mobile Layout (320px - 749px)

**Container**:
- Max width: 100% (full bleed)
- Padding: 16px (sides), 20px (top/bottom)
- Background: #ffffff
- Border radius: 0 (full width on mobile)

**Pet Count Selector**:
```css
.pet-count-selector {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 8px;
  padding: 12px 0;
  margin-bottom: 24px;

  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.pet-count-selector::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.pet-count-btn {
  flex: 0 0 60px;
  height: 44px;
  scroll-snap-align: start;

  /* Touch-friendly */
  font-size: 16px;
  font-weight: 600;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #ffffff;
  color: #666666;

  /* Transitions */
  transition: all 0.2s ease;
}

.pet-count-btn.active {
  background: #10b981; /* Green */
  color: #ffffff;
  border-color: #10b981;
  transform: scale(1.05);
}
```

**Pet Details Accordion**:
```css
.pet-section {
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
}

.pet-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  cursor: pointer;

  /* Touch feedback */
  -webkit-tap-highlight-color: rgba(16, 185, 129, 0.1);
}

.pet-section-header h4 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.pet-section-content {
  padding: 16px;
  display: none; /* Accordion closed by default */
}

.pet-section.open .pet-section-content {
  display: block;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Style/Font Cards**:
```css
/* Style Selector - 2x2 Grid */
.style-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.style-card {
  aspect-ratio: 1 / 1; /* Square cards */
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.style-card.selected {
  border-color: #10b981;
  border-width: 3px;
}

.style-card-image {
  width: 100%;
  height: 80%;
  object-fit: cover;
}

.style-card-label {
  height: 20%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  background: #f8f9fa;
}

/* Font Selector - 3x2 Grid */
.font-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 24px;
}

.font-card {
  min-height: 90px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.font-card.selected {
  border-color: #10b981;
  border-width: 3px;
}

.font-card-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 8px;
}

.font-card-preview {
  font-size: 16px;
  color: #1a1a1a;
  /* Font family applied inline per card */
}
```

**Add to Cart Button**:
```css
.add-to-cart-btn {
  width: 100%;
  height: 56px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;

  /* Sticky to bottom on mobile */
  position: sticky;
  bottom: 16px;
  z-index: 10;

  /* Transitions */
  transition: all 0.3s ease;
}

.add-to-cart-btn:disabled {
  background: #e0e0e0;
  color: #999999;
  cursor: not-allowed;
  opacity: 0.6;
}

.add-to-cart-btn:not(:disabled) {
  background: #10b981;
  color: #ffffff;
}

.add-to-cart-btn:not(:disabled):active {
  transform: scale(0.98);
}
```

---

### Desktop Layout (750px+)

**Container**:
- Max width: 800px
- Padding: 32px
- Background: #ffffff
- Border: 1px solid #e0e0e0
- Border radius: 16px
- Margin: 40px auto

**Pet Count Selector**:
```css
@media (min-width: 750px) {
  .pet-count-selector {
    justify-content: flex-start;
    overflow-x: visible; /* No scroll */
    gap: 12px;
  }

  .pet-count-btn {
    flex: 0 0 50px;
    height: 40px;
  }
}
```

**Pet Details - No Accordion**:
```css
@media (min-width: 750px) {
  .pet-section-content {
    display: block !important; /* Always visible */
  }

  .pet-section-header {
    cursor: default; /* Not clickable */
    background: transparent;
    border-bottom: 2px solid #e0e0e0;
  }
}
```

**Style Selector - 1x4 Row**:
```css
@media (min-width: 750px) {
  .style-selector {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .style-card {
    aspect-ratio: 1 / 1.1; /* Slightly taller */
  }
}
```

**Font Selector - 1x6 Row**:
```css
@media (min-width: 750px) {
  .font-selector {
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  .font-card {
    min-height: 100px;
  }

  .font-card-preview {
    font-size: 18px;
  }
}
```

---

## 4. Interaction Patterns

### Pet Count Selection

**Interaction**:
1. User taps button (e.g., "3")
2. Button scales up (1.05x) with 0.2s ease
3. Button background changes to green
4. Previous selection reverts to default
5. Pet sections dynamically show/hide (slide animation)
6. Scroll to first incomplete pet section

**Edge Case**: User switches from 3 pets → 1 pet
- Show confirmation dialog: "You have data for 3 pets. Switch to 1 pet? Data for pets 2-3 will be removed."
- If confirmed: Clear pets 2-3 data, collapse sections
- If cancelled: Revert to 3 pets

**Accessibility**:
- ARIA role: `radiogroup`
- Each button: `role="radio"`, `aria-checked="true/false"`
- Keyboard navigation: Arrow keys to move, Enter/Space to select
- Screen reader: "Pet count selector. 1 selected. Button 1 of 10"

---

### Per-Pet Data Entry

**Name Input**:
```
Interaction Flow:
1. User taps input → Keyboard appears
2. User types "Buddy" → Real-time validation (alphanumeric only)
3. Invalid character (e.g., @) → Shake animation, reject input
4. Valid input → Update font card previews (debounced 300ms)
5. User blurs input → Mark section as "in progress" (partial complete)

Validation:
- Allowed: A-Z, a-z, 0-9, comma, space, hyphen, apostrophe
- Max length: 100 characters
- Min length: 1 character
- Pattern: /^[A-Za-z0-9, \-']+$/

Visual Feedback:
- Valid: Green checkmark icon (right side of input)
- Invalid: Red X icon + error message below
- In progress: Blue outline on input
```

**Upload Button**:
```
Interaction Flow:
1. User taps "Choose File" → Native file picker opens
2. User selects image → File validation starts
3. Valid (< 50MB, image type) → Upload progress bar (0-100%)
4. Upload completes → Show thumbnail (80px x 80px)
5. Thumbnail visible → Replace "Choose File" with "Change Photo" button

File Validation:
- Max size: 50MB
- Allowed types: image/jpeg, image/png, image/heic, image/webp
- Min dimensions: 500px x 500px
- Max dimensions: 8000px x 8000px

Progress Indicator:
┌─────────────────────────────┐
│ Uploading... 45%            │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░        │
└─────────────────────────────┘

Error States:
❌ "File too large. Max 50MB."
❌ "Invalid file type. Use JPG, PNG, or HEIC."
❌ "Image too small. Minimum 500x500px."
```

**"Use Existing Perkie Print" Toggle**:
```
Interaction Flow:
1. User checks box → Slide down animation (200ms)
2. Input field appears → Auto-focus (keyboard appears)
3. User types "#1001" → Format validation (real-time)
4. User blurs input → API call to validate order number
5. Valid order → Fetch pet image from order
6. Image loaded → Show thumbnail, hide upload button
7. Invalid order → Show error message, keep input visible

Checkbox States:
☐ Unchecked (default) → Upload buttons visible
☑ Checked → Order number input visible
☑ Checked + Valid → Thumbnail visible, upload hidden

Toggle Behavior:
- Check box when unchecked → Expand input
- Uncheck box when checked → Collapse input, clear data
- Smooth height transition (0.2s ease)
```

---

### Style Selection

**Interaction**:
```
1. User taps "Modern" card → Immediate visual feedback
2. Card border thickens (2px → 3px, green color)
3. Checkmark overlay appears (top-right corner)
4. Previous selection deselected (border returns to gray)
5. State saved to localStorage (for refresh persistence)
6. Validation check → Enable "Add to Cart" if all fields complete

Visual States:
Default: 2px gray border, no checkmark
Hover (desktop): 2px blue border, subtle shadow
Active (tap): Scale to 0.95x (100ms), then return
Selected: 3px green border, checkmark overlay

Checkmark Overlay:
┌──────────────────────┐
│   [Example Image]    │
│                  ✅  │ ← Position: top-right, 8px padding
├──────────────────────┤
│    ● Modern          │ ← Bold text, radio dot
└──────────────────────┘
```

**Accessibility**:
- Role: `radiogroup` (container), `radio` (each card)
- ARIA: `aria-checked="true"` on selected card
- Keyboard: Tab to focus, Arrow keys to navigate, Space/Enter to select
- Screen reader: "Modern style. Image showing ink wash effect. Radio button 3 of 4. Selected."

---

### Font Selection

**Interaction**:
```
1. User taps "Preppy" card → Visual feedback
2. Card border thickens (2px → 3px, green)
3. Card background changes to light green tint
4. Font preview updates to show ALL pet names entered
   - Single pet: "Buddy"
   - Multiple pets: "Buddy, Lucy, Max"
   - 6+ pets: "Buddy, Lucy, Max, Charlie, Daisy, +2 more"
5. State saved to localStorage
6. Validation check

Live Preview Update (as user types pet names):
User types "B" → All cards show "B"
User types "u" → All cards show "Bu"
User types "ddy" → All cards show "Buddy"
User adds ", Lucy" → All cards show "Buddy, Lucy"

Debouncing (300ms):
- Prevents lag during typing
- Updates only after user pauses
- Smooth performance even with 10 pets
```

**Special Case: "Blank" Font**:
```
Card Design:
┌──────────────┐
│   BLANK      │ ← Label
│              │
│  (No Name)   │ ← Italic, gray, smaller font
│              │
└──────────────┘

Behavior When Selected:
- Pet name input field becomes optional (removes "required" attribute)
- Help text updates: "No names will appear on product"
- Cart data: fontStyle = "no-text"
```

---

### Add to Cart

**Validation Flow**:
```
1. User clicks "Add to Cart" → Run final validation
2. Check all required fields:
   - petCount > 0 ✅
   - All pets have names ✅
   - All pets have images ✅
   - Style selected ✅
   - Font selected ✅
3. If any fail → Scroll to first error, shake field, show message
4. If all pass → Proceed to cart

Cart Object Structure:
{
  properties: {
    _pet_count: 3,
    _pet_names: "Buddy, Lucy, Max",
    _pet_images: "https://..., https://..., https://...",
    _selected_style: "modern",
    _selected_font: "preppy",
    _artist_notes: "Note 1||Note 2||Note 3", // Double-pipe delimiter
    _previous_orders: "||#1001||" // Empty if not used
  }
}

Processing State:
1. Button text: "Adding to Cart..." (with spinner)
2. Disable button (prevent double-submit)
3. API call to Shopify cart
4. Success → Redirect to cart page
5. Error → Show error message, re-enable button
```

**Error Handling**:
```
Network Error:
❌ "Network error. Check connection and try again."

Server Error:
❌ "Something went wrong. Please try again."

Validation Error:
⚠️ "Please complete all fields:
   • Pet 2: Add a photo
   • Pet 3: Enter a name"

Recovery:
- Button remains enabled
- User can retry immediately
- Data persists (not lost)
```

---

## 5. Mobile vs Desktop Considerations

### Mobile-Specific Features

**1. Sticky Add to Cart Button**:
```css
.add-to-cart-btn {
  position: sticky;
  bottom: 16px;
  z-index: 10;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1); /* Elevation effect */
}
```
- Reason: Always visible (no need to scroll down)
- Alternative: Fixed bottom bar (rejected - covers content)

**2. Accordion for Pet Sections**:
- Reason: Reduces scrolling, focuses attention
- Implementation: Native `<details>` element (accessible, no JS needed)
- Auto-expand: JavaScript to open next incomplete section

**3. Horizontal Scroll for Pet Count** (1-10):
- Reason: Maintains button size (no shrinking to fit)
- Visual cue: Fade edges to indicate scroll
- Smooth scrolling: `scroll-behavior: smooth;`

**4. Touch Feedback**:
```css
.interactive-element {
  -webkit-tap-highlight-color: rgba(16, 185, 129, 0.2);
}

.interactive-element:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}
```

**5. Mobile Keyboard Optimization**:
```html
<!-- Pet Name Input -->
<input type="text"
       inputmode="text"
       autocapitalize="words"
       autocomplete="off"
       autocorrect="on">

<!-- Order Number Input -->
<input type="text"
       inputmode="numeric"
       autocomplete="off"
       pattern="[#]?[0-9]+">
```

**6. File Upload from Camera**:
```html
<input type="file"
       accept="image/*"
       capture="environment"> <!-- Prefers back camera -->
```

---

### Desktop-Specific Features

**1. No Accordion** (All sections visible):
- Reason: More screen space, users expect overview
- Implementation: `.pet-section-content { display: block !important; }`

**2. Hover States**:
```css
@media (hover: hover) {
  .style-card:hover {
    border-color: #3b82f6; /* Blue */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}
```

**3. Keyboard Navigation**:
- Tab order: Pet count → Pet 1 name → Pet 1 upload → ... → Style → Font → Add to Cart
- Arrow keys: Navigate within pet count, style, font selectors
- Enter/Space: Select current focused element
- Escape: Close modals/dropdowns

**4. Tooltip Hints** (Desktop only):
```html
<button data-tooltip="Upload a clear photo of your pet (JPG, PNG, HEIC)">
  Choose File
</button>
```
- Implementation: CSS `::after` pseudo-element
- Trigger: `hover` (not on mobile)

**5. Drag-and-Drop Upload** (Desktop only):
```javascript
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  handleFileUpload(files);
});
```

**6. Multi-Column Layouts**:
```
Desktop (>1200px):
┌─────────────────────────────────────┐
│ Pet Details (Left)  │  Style/Font  │
│ - Pet 1             │  (Right)     │
│ - Pet 2             │              │
│ - Pet 3             │  [Cards]     │
└─────────────────────────────────────┘
```
- Reason: Utilize horizontal space
- Benefit: Less scrolling, better overview

---

### Responsive Breakpoints

```css
/* Mobile Small (320px - 374px) */
@media (max-width: 374px) {
  .pet-count-btn { flex: 0 0 50px; }
  .font-card-preview { font-size: 14px; }
}

/* Mobile Medium (375px - 749px) */
@media (min-width: 375px) and (max-width: 749px) {
  .style-selector { gap: 12px; }
  .font-selector { gap: 8px; }
}

/* Tablet (750px - 999px) */
@media (min-width: 750px) and (max-width: 999px) {
  .pet-selector-container { max-width: 700px; }
  .style-selector { grid-template-columns: repeat(4, 1fr); }
}

/* Desktop (1000px+) */
@media (min-width: 1000px) {
  .pet-selector-container { max-width: 800px; }
  .style-selector { grid-template-columns: repeat(4, 1fr); }
  .font-selector { grid-template-columns: repeat(6, 1fr); }
}

/* Large Desktop (1200px+) */
@media (min-width: 1200px) {
  .pet-selector-container { max-width: 1000px; }
  /* Two-column layout: Pet details | Style/Font */
}
```

---

## 6. HTML/Liquid Structure

### Main Container Structure

```liquid
{% comment %}
  ks-product-pet-selector.liquid
  Stitch UI Pattern Implementation
{% endcomment %}

{% assign max_pets = product.metafields.custom.max_pets | default: 1 %}
{% assign has_text = product.metafields.custom.has_text | default: true %}

<div class="pet-selector-container"
     data-section-id="{{ section.id }}"
     data-max-pets="{{ max_pets }}"
     data-has-text="{{ has_text }}"
     data-product-id="{{ product.id }}">

  <!-- Section 1: Pet Count Selector -->
  <div class="pet-count-section">
    <h3 class="section-title">Number of Pets</h3>
    <div class="pet-count-selector" role="radiogroup" aria-label="Select number of pets">
      {% for i in (1..max_pets) %}
        <button type="button"
                class="pet-count-btn {% if i == 1 %}active{% endif %}"
                data-pet-count="{{ i }}"
                role="radio"
                aria-checked="{% if i == 1 %}true{% else %}false{% endif %}"
                aria-label="{{ i }} pet{% if i > 1 %}s{% endif %}">
          {{ i }}
        </button>
      {% endfor %}
    </div>
  </div>

  <!-- Section 2: Pet Details (Dynamic) -->
  <div class="pet-details-section">
    <h3 class="section-title">Your Pet's Details</h3>
    <div class="pet-sections-container" data-pet-sections>
      {% for i in (1..max_pets) %}
        {% render 'pet-section-item',
           pet_number: i,
           section_id: section.id,
           is_visible: i == 1 %}
      {% endfor %}
    </div>
  </div>

  <!-- Section 3: Style Selector -->
  <div class="style-section">
    <h3 class="section-title">Choose Style</h3>
    <p class="section-description">Select an artistic effect for all pets</p>
    <div class="style-selector" role="radiogroup" aria-label="Select artistic style">
      {% render 'style-card',
         style_id: 'enhancedblackwhite',
         style_name: 'Black & White',
         preview_image: 'preview-bw.jpg' %}
      {% render 'style-card',
         style_id: 'color',
         style_name: 'Color',
         preview_image: 'preview-color.jpg' %}
      {% render 'style-card',
         style_id: 'modern',
         style_name: 'Modern',
         preview_image: 'preview-modern.jpg' %}
      {% render 'style-card',
         style_id: 'sketch',
         style_name: 'Sketch',
         preview_image: 'preview-sketch.jpg' %}
    </div>
  </div>

  <!-- Section 4: Font Selector (Conditional) -->
  {% if has_text %}
    {% render 'pet-font-selector', section_id: section.id %}
  {% endif %}

  <!-- Section 5: Add to Cart -->
  <div class="cart-section">
    <div class="validation-summary" data-validation-summary style="display: none;">
      <!-- Dynamic validation messages -->
    </div>

    <button type="button"
            class="add-to-cart-btn"
            data-add-to-cart
            disabled
            aria-live="polite">
      <span class="btn-text">Add to Cart</span>
      <span class="btn-price" data-total-price>{{ product.price | money }}</span>
    </button>

    <p class="help-text" data-help-text>
      Complete all fields above to add to cart
    </p>
  </div>
</div>
```

---

### Pet Section Item Snippet

```liquid
{% comment %}
  snippets/pet-section-item.liquid
  Individual pet data collection section
{% endcomment %}

<details class="pet-section"
         data-pet-section
         data-pet-id="pet_{{ pet_number }}"
         {% if is_visible %}open{% endif %}>

  <summary class="pet-section-header">
    <h4 class="pet-section-title">
      <span class="pet-label">Pet {{ pet_number }}</span>
      <span class="pet-name-display" data-pet-name-display></span>
    </h4>
    <div class="pet-section-status">
      <span class="status-icon" data-status-icon>○</span>
      <span class="expand-icon">▼</span>
    </div>
  </summary>

  <div class="pet-section-content">

    <!-- Pet Name Input -->
    <div class="form-field">
      <label for="pet-name-{{ pet_number }}-{{ section_id }}">
        Pet Name <span class="required">*</span>
      </label>
      <input type="text"
             id="pet-name-{{ pet_number }}-{{ section_id }}"
             name="properties[_pet_{{ pet_number }}_name]"
             class="form-input"
             placeholder="e.g., Buddy"
             required
             maxlength="50"
             pattern="[A-Za-z0-9 \-']+"
             autocapitalize="words"
             data-pet-name-input>
      <span class="field-error" data-error-message style="display: none;"></span>
    </div>

    <!-- Upload Buttons -->
    <div class="form-field">
      <label>
        Pet Image <span class="required">*</span>
      </label>
      <div class="upload-buttons">
        <button type="button"
                class="btn-upload-primary"
                data-upload-trigger>
          📸 Upload Photo
        </button>
        <input type="file"
               id="pet-upload-{{ pet_number }}-{{ section_id }}"
               accept="image/*"
               capture="environment"
               data-file-input
               style="display: none;">
      </div>

      <!-- Thumbnail Preview (Hidden by default) -->
      <div class="upload-preview" data-upload-preview style="display: none;">
        <img src="" alt="Pet preview" data-preview-image>
        <button type="button" class="btn-change" data-change-photo>
          Change Photo
        </button>
      </div>

      <!-- Upload Progress -->
      <div class="upload-progress" data-upload-progress style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" data-progress-fill style="width: 0%;"></div>
        </div>
        <span class="progress-text" data-progress-text>Uploading... 0%</span>
      </div>
    </div>

    <!-- "Use Existing Perkie Print" Option -->
    <div class="form-field">
      <label class="checkbox-label">
        <input type="checkbox"
               id="use-previous-{{ pet_number }}-{{ section_id }}"
               data-use-previous-toggle>
        <span>Use Existing Perkie Print</span>
      </label>

      <!-- Order Number Input (Conditional) -->
      <div class="previous-order-input"
           data-previous-order-input
           style="display: none;">
        <label for="order-number-{{ pet_number }}-{{ section_id }}">
          Previous Order Number
        </label>
        <input type="text"
               id="order-number-{{ pet_number }}-{{ section_id }}"
               name="properties[_pet_{{ pet_number }}_order]"
               class="form-input"
               placeholder="#1001"
               inputmode="numeric"
               pattern="[#]?[0-9]+"
               maxlength="10"
               data-order-number-input>
        <small class="field-help">
          Found in your order confirmation email
        </small>
        <span class="field-error" data-order-error style="display: none;"></span>
      </div>
    </div>

    <!-- Artist Note (Optional, from pet processor) -->
    <input type="hidden"
           name="properties[_pet_{{ pet_number }}_note]"
           data-artist-note>

  </div>
</details>
```

---

### Style Card Snippet

```liquid
{% comment %}
  snippets/style-card.liquid
  Individual style selection card
{% endcomment %}

<label class="style-card"
       data-style-card
       data-style-id="{{ style_id }}">

  <input type="radio"
         name="properties[_selected_style]"
         value="{{ style_id }}"
         class="style-radio"
         role="radio"
         aria-label="{{ style_name }} style">

  <div class="style-card-content">
    <div class="style-card-image-wrapper">
      <img src="{{ 'preview-' | append: preview_image | asset_url }}"
           alt="{{ style_name }} effect example"
           class="style-card-image"
           loading="lazy">
      <span class="style-checkmark" data-checkmark>✅</span>
    </div>
    <div class="style-card-label">{{ style_name }}</div>
  </div>
</label>
```

---

### Font Selector Update

```liquid
{% comment %}
  snippets/pet-font-selector.liquid
  Updated for global selection with live preview
{% endcomment %}

<div class="font-section">
  <h3 class="section-title">Choose Font</h3>
  <p class="section-description">
    Font style for <span class="font-pet-names" data-font-pet-names>your pet's name</span>
  </p>

  <div class="font-selector" role="radiogroup" aria-label="Select font style">

    {% assign fonts = "preppy,classic,playful,elegant,trend,no-text" | split: "," %}
    {% assign font_names = "Preppy,Classic,Playful,Elegant,Trend,Blank" | split: "," %}
    {% assign font_families = "'Libre Caslon Text',serif|'Merriweather',serif|'Rampart One',cursive|'Ms Madi',cursive|'Fascinate',cursive|inherit" | split: "|" %}

    {% for i in (0..5) %}
      <label class="font-card"
             data-font-card
             data-font-id="{{ fonts[i] }}">

        <input type="radio"
               name="properties[_selected_font]"
               value="{{ fonts[i] }}"
               class="font-radio"
               {% if i == 1 %}checked{% endif %}
               role="radio"
               aria-label="{{ font_names[i] }} font">

        <div class="font-card-content">
          <div class="font-card-label">{{ font_names[i] }}</div>
          <div class="font-card-preview"
               data-font-preview
               style="font-family: {{ font_families[i] }};">
            <span class="preview-text" data-preview-text>
              {% if fonts[i] == "no-text" %}
                (No Name)
              {% else %}
                Buddy
              {% endif %}
            </span>
          </div>
        </div>
      </label>
    {% endfor %}

  </div>
</div>
```

---

### Class Naming Convention

**BEM Methodology** (Block Element Modifier):

```
Block: .pet-selector-container
Element: .pet-selector-container__header
Modifier: .pet-selector-container__header--sticky

Examples:
.pet-count-selector (Block)
.pet-count-selector__btn (Element)
.pet-count-selector__btn--active (Modifier)

.pet-section (Block)
.pet-section__header (Element)
.pet-section__header--complete (Modifier)
.pet-section__content (Element)

.style-card (Block)
.style-card__image (Element)
.style-card__label (Element)
.style-card--selected (Modifier)
```

**Why BEM**:
- Clear component ownership
- Prevents CSS conflicts
- Self-documenting HTML
- Easy to search/replace

**Data Attributes** (for JavaScript hooks):

```
data-pet-section (Component identifier)
data-pet-id="pet_1" (Unique identifier)
data-upload-trigger (Action trigger)
data-preview-image (Data target)
data-validation-summary (UI update target)
```

**Why data attributes**:
- Separate styling from behavior
- JavaScript-independent CSS
- Clear intent in HTML
- Easy to query (`querySelector('[data-upload-trigger]')`)

---

## 7. Visual Design Specifications

### Color Palette

```
Primary Colors:
--color-primary: #10b981 (Green - Selected states, CTA buttons)
--color-primary-hover: #059669 (Darker green - Hover states)
--color-primary-light: #d1fae5 (Light green - Backgrounds)

Neutral Colors:
--color-text-primary: #1a1a1a (Headings, labels)
--color-text-secondary: #666666 (Descriptions, help text)
--color-text-tertiary: #999999 (Disabled states)
--color-border: #e0e0e0 (Default borders)
--color-border-active: #3b82f6 (Focus/hover borders)
--color-background: #ffffff (Cards, containers)
--color-background-alt: #f8f9fa (Section backgrounds)

Status Colors:
--color-error: #ef4444 (Errors, validation)
--color-warning: #f59e0b (Warnings)
--color-success: #10b981 (Success messages)
--color-info: #3b82f6 (Info messages)
```

---

### Typography

```
Font Families:
--font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, sans-serif
--font-heading: 'Merriweather', Georgia, serif (Optional: Match theme)

Font Sizes (Mobile-first):
--text-xs: 12px   (Help text, captions)
--text-sm: 14px   (Form labels, descriptions)
--text-base: 16px (Body text, inputs)
--text-lg: 18px   (Button text, emphasis)
--text-xl: 20px   (Section titles)
--text-2xl: 24px  (Main headings)

Font Weights:
--weight-normal: 400 (Body text)
--weight-medium: 500 (Descriptions)
--weight-semibold: 600 (Labels, buttons)
--weight-bold: 700 (Headings)

Line Heights:
--leading-tight: 1.2 (Headings)
--leading-normal: 1.5 (Body text)
--leading-relaxed: 1.75 (Help text)
```

**Desktop Adjustments**:
```css
@media (min-width: 750px) {
  --text-xs: 13px;
  --text-sm: 15px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 28px;
}
```

---

### Spacing System

**8px Base Grid**:

```
--space-1: 4px   (0.5 units)
--space-2: 8px   (1 unit)
--space-3: 12px  (1.5 units)
--space-4: 16px  (2 units)
--space-5: 20px  (2.5 units)
--space-6: 24px  (3 units)
--space-8: 32px  (4 units)
--space-10: 40px (5 units)
--space-12: 48px (6 units)

Usage:
- Component padding: --space-4 (16px)
- Section margins: --space-6 (24px mobile), --space-8 (32px desktop)
- Input padding: --space-3 (12px)
- Button padding: --space-4 (16px vertical), --space-6 (24px horizontal)
- Gap between cards: --space-3 (12px)
```

---

### Border Radius

```
--radius-sm: 4px  (Input fields, small buttons)
--radius-md: 8px  (Cards, containers)
--radius-lg: 12px (Large cards, modals)
--radius-xl: 16px (Main container)
--radius-full: 9999px (Circular elements)

Usage:
- Pet section cards: --radius-lg (12px)
- Style/font cards: --radius-md (8px)
- Input fields: --radius-sm (4px)
- Add to cart button: --radius-lg (12px)
- Checkmark overlay: --radius-full (circular)
```

---

### Shadows

```
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15)

Usage:
- Cards (default): --shadow-sm
- Cards (hover): --shadow-md
- Sticky CTA button: --shadow-lg
- Modals: --shadow-xl
```

---

### Transitions

```
--transition-fast: 0.1s ease
--transition-normal: 0.2s ease
--transition-slow: 0.3s ease

Usage:
- Button press: --transition-fast (0.1s)
- Border color change: --transition-normal (0.2s)
- Accordion expand: --transition-normal (0.2s)
- Fade in/out: --transition-slow (0.3s)

Easing Functions:
- ease: Default (smooth start/end)
- ease-in-out: Symmetric (smooth both ends)
- ease-out: Fast start, slow end (recommended for UI)
- cubic-bezier(0.4, 0, 0.2, 1): Custom (Material Design)
```

---

### Icons

**Recommended**: Use emoji for simplicity (no icon library needed)

```
📸 - Upload/Camera
✅ - Checkmark/Success
❌ - Error/Remove
⚠️ - Warning
ℹ️ - Info
○ - Incomplete (circle outline)
● - Selected (filled circle)
▼ - Expanded (down arrow)
▶ - Collapsed (right arrow)
🎨 - Style/Art

Why emoji:
- No extra HTTP requests
- Cross-platform support
- Accessible (screen readers read as text)
- Easy to update
```

**Alternative**: If brand requires custom icons, use inline SVG

```html
<svg class="icon icon-checkmark" width="20" height="20" viewBox="0 0 20 20">
  <path d="M7 10l2 2 4-4" stroke="currentColor" fill="none"/>
</svg>
```

---

## 8. Error & Validation States

### Field-Level Validation

**Pet Name Input**:

```
States:
1. Default (untouched)
   Border: 2px solid #e0e0e0
   Background: #ffffff

2. Focus (user typing)
   Border: 2px solid #3b82f6 (blue)
   Background: #ffffff
   Outline: None (custom focus ring)

3. Valid (after blur)
   Border: 2px solid #10b981 (green)
   Icon: ✅ (right side)

4. Invalid (after blur)
   Border: 2px solid #ef4444 (red)
   Icon: ❌ (right side)
   Error message: "Please enter a valid pet name (letters and numbers only)"

5. Disabled
   Border: 2px solid #e0e0e0
   Background: #f8f9fa
   Opacity: 0.6
   Cursor: not-allowed
```

**CSS Implementation**:
```css
.form-input {
  border: 2px solid var(--color-border);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  border-color: var(--color-info);
  outline: none;
}

.form-input.valid {
  border-color: var(--color-success);
}

.form-input.invalid {
  border-color: var(--color-error);
}

.field-error {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  color: var(--color-error);
}
```

---

### Upload Validation

**File Validation Errors**:

```
Too Large:
❌ "File too large. Maximum size is 50MB."
Suggestion: "Try compressing the image or choosing a different photo."

Invalid Type:
❌ "Invalid file type. Please upload JPG, PNG, HEIC, or WebP."

Too Small (dimensions):
❌ "Image is too small. Minimum size is 500x500 pixels."

Network Error:
❌ "Upload failed. Check your connection and try again."
Button: [Retry] (re-triggers upload)

Success:
✅ "Photo uploaded successfully!"
(Auto-dismiss after 3 seconds)
```

**Visual Feedback During Upload**:

```
1. File selected → Show progress bar
┌─────────────────────────────┐
│ Uploading "dog.jpg"         │
│ ▓▓▓▓▓▓▓░░░░░░░░░░░░░        │ 35%
│ Cancel                      │
└─────────────────────────────┘

2. Upload complete → Show thumbnail
┌─────────────────────────────┐
│   [Thumbnail 80x80px]       │
│   dog.jpg (2.3 MB)          │
│   ✅ Upload complete         │
│   [Change Photo]            │
└─────────────────────────────┘

3. Upload failed → Show error + retry
┌─────────────────────────────┐
│   ❌ Upload failed           │
│   Network error occurred.   │
│   [Retry] [Choose Different]│
└─────────────────────────────┘
```

---

### Order Number Validation

**Real-Time Validation** (as user types):

```
Format: #1001 or 1001 (# is optional)

Input: "1"
Status: Too short (no error yet, wait for completion)

Input: "10"
Status: Too short (no error yet)

Input: "1001"
Status: Valid format ✅ (green border, proceed to API check)

Input: "10a1"
Status: Invalid ❌ "Order number must be numeric"

Input: "#1001"
Status: Valid format ✅
```

**API Validation** (on blur):

```
1. Valid format → Call API
   Loading: Show spinner next to input

2. API Response: Order found
   Success: ✅ "Order #1001 found! Fetching pet image..."
   Action: Replace upload section with thumbnail

3. API Response: Order not found
   Error: ❌ "Order #1001 not found. Please check your confirmation email."
   Action: Keep input visible, allow retry

4. API Response: Order has no pet images
   Error: ⚠️ "Order #1001 has no saved pet images. Please upload a new photo."
   Action: Auto-uncheck "Use Existing" box, show upload buttons

5. API Error: Network/server issue
   Error: ❌ "Unable to verify order number. Please try again."
   Action: [Retry] button appears
```

---

### Form-Level Validation

**Add to Cart Validation Summary**:

When user clicks "Add to Cart" with incomplete data:

```
┌─────────────────────────────────────┐
│ ⚠️ Please complete the following:   │
│                                     │
│ • Pet 2: Enter a name               │
│ • Pet 2: Upload a photo             │
│ • Pet 3: Enter a name               │
│ • Choose an artistic style          │
│                                     │
│ [Scroll to First Error]             │
└─────────────────────────────────────┘

Position: Top of pet selector (scrolls into view)
Behavior: Auto-focus first incomplete field
Dismissible: Yes (X button in top-right)
```

**JavaScript Validation Logic**:

```javascript
function validateForm() {
  const errors = [];
  const state = window.petSelectorState;

  // Check pet details
  state.pets.forEach((pet, index) => {
    if (!pet.name) {
      errors.push(`Pet ${index + 1}: Enter a name`);
    }
    if (!pet.imageUrl && !pet.previousOrderNumber) {
      errors.push(`Pet ${index + 1}: Upload a photo or enter order number`);
    }
  });

  // Check style selection
  if (!state.selectedStyle) {
    errors.push('Choose an artistic style');
  }

  // Check font selection (if product has text)
  if (state.hasText && !state.selectedFont) {
    errors.push('Choose a font style');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
```

---

### Success States

**Section Completion**:

```
Pet Section Complete:
┌─────────────────────────────────┐
│ Pet 1: Buddy          ✅ ▶      │ ← Collapsed, green checkmark
└─────────────────────────────────┘

All Sections Complete:
✅ "All pet details complete! Choose a style below."
(Green banner at top of page)
```

**Add to Cart Success**:

```
Button State:
1. Click "Add to Cart"
   → Button text: "Adding to Cart..." (spinner)

2. API Success
   → Button text: "Added! ✅" (brief confirmation)
   → Redirect to cart (after 1 second)

3. If redirect fails
   → Manual link appears: "View Cart →"
```

---

## 9. Accessibility Requirements

### WCAG 2.1 Level AA Compliance

**Color Contrast**:

```
Text Contrast Ratios (minimum):
- Normal text (< 18px): 4.5:1
- Large text (≥ 18px): 3:1
- UI components: 3:1

Tested Combinations:
✅ #1a1a1a on #ffffff (16.3:1) - Excellent
✅ #666666 on #ffffff (5.7:1) - Good
✅ #10b981 on #ffffff (2.1:1) - FAIL for text (use for borders only)
✅ #ffffff on #10b981 (3.8:1) - Good (button text)
❌ #999999 on #ffffff (2.8:1) - FAIL for normal text (only use for large text 18px+)

Action: Use #666666 for secondary text, not #999999
```

---

### Keyboard Navigation

**Tab Order** (logical flow):

```
1. Pet count button 1
2. Pet count button 2
...
N. Pet count button 10

N+1. Pet 1: Name input
N+2. Pet 1: Upload button
N+3. Pet 1: "Use Existing" checkbox
N+4. Pet 1: Order number input (if visible)

...

M. Style card 1
M+1. Style card 2
M+2. Style card 3
M+3. Style card 4

M+4. Font card 1
...
M+9. Font card 6

M+10. Add to Cart button
```

**Focus Indicators**:

```css
/* Remove default browser outline */
*:focus {
  outline: none;
}

/* Custom focus ring (more visible) */
.focusable:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Exception: Inputs have border instead of outline */
input:focus-visible {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

---

### Screen Reader Support

**ARIA Labels**:

```html
<!-- Pet Count Selector -->
<div class="pet-count-selector"
     role="radiogroup"
     aria-label="Select number of pets">
  <button role="radio"
          aria-checked="true"
          aria-label="1 pet">1</button>
  <button role="radio"
          aria-checked="false"
          aria-label="2 pets">2</button>
</div>

<!-- Pet Section -->
<details class="pet-section"
         aria-labelledby="pet-1-title"
         aria-expanded="true">
  <summary id="pet-1-title">
    Pet 1: Buddy
  </summary>
  ...
</details>

<!-- Form Input -->
<label for="pet-name-1">
  Pet Name <span class="required" aria-label="required">*</span>
</label>
<input id="pet-name-1"
       aria-required="true"
       aria-invalid="false"
       aria-describedby="pet-name-1-error">
<span id="pet-name-1-error" role="alert" aria-live="polite">
  <!-- Error message appears here -->
</span>

<!-- Style Card -->
<label class="style-card" aria-label="Black and white effect">
  <input type="radio"
         role="radio"
         aria-checked="false"
         name="style">
  <img alt="Example of black and white artistic effect" ...>
  <span>Black & White</span>
</label>

<!-- Add to Cart Button -->
<button aria-live="polite"
        aria-disabled="true"
        aria-label="Add to cart. Complete all fields to enable.">
  Add to Cart - $29.99
</button>
```

**Live Regions** (dynamic updates):

```html
<!-- Validation Summary -->
<div role="alert"
     aria-live="assertive"
     aria-atomic="true"
     class="validation-summary">
  <!-- Screen reader announces immediately when errors appear -->
  Please complete the following: Pet 2 enter a name, Pet 2 upload a photo
</div>

<!-- Upload Progress -->
<div role="status"
     aria-live="polite"
     aria-atomic="true">
  Uploading... 45%
</div>

<!-- Success Message -->
<div role="status"
     aria-live="polite">
  Photo uploaded successfully
</div>
```

---

### Alternative Text

**Image Alt Text Best Practices**:

```html
<!-- Good: Descriptive -->
<img src="preview-modern.jpg"
     alt="Example of modern ink wash effect applied to a golden retriever">

<!-- Bad: Redundant -->
<img src="preview-modern.jpg"
     alt="Modern style">

<!-- Good: Functional -->
<img src="pet-thumbnail.jpg"
     alt="Uploaded photo of Buddy the golden retriever">

<!-- Good: Empty alt for decorative -->
<img src="checkmark-icon.svg"
     alt=""
     role="presentation"> <!-- Icon is decorative, label provides context -->
```

---

### Touch Target Sizes

**WCAG 2.5.5 Compliance** (Target Size - Enhanced, Level AAA):

```
Minimum: 44px × 44px (Level AA)
Recommended: 48px × 48px (Level AAA)

Applied to:
✅ Pet count buttons: 60px × 44px
✅ Upload buttons: Full width × 48px
✅ Style cards: 155px × 140px (mobile)
✅ Font cards: 100px × 90px (mobile)
✅ Checkboxes: 24px × 24px + 20px padding = 44px total
✅ Radio buttons: Same as checkboxes
✅ Close buttons: 44px × 44px
✅ "Change Photo" buttons: 120px × 44px

Exception:
Font cards (100px × 90px) - While width is 100px, minimum dimension is 90px.
This passes Level AA (44px) but consider increasing to 100px height on very small screens (<375px).
```

---

### Semantic HTML

**Use Native Elements** (better accessibility):

```html
<!-- Good: Native <details> for accordion -->
<details open>
  <summary>Pet 1: Buddy</summary>
  <div>Content here</div>
</details>

<!-- Bad: Custom div accordion -->
<div class="accordion" data-accordion>
  <div class="accordion-header" onclick="toggle()">Pet 1</div>
  <div class="accordion-content">Content here</div>
</div>

<!-- Good: Native <input type="file"> -->
<label for="upload">
  <input type="file" id="upload" accept="image/*">
  Upload Photo
</label>

<!-- Good: Native <fieldset> for radio groups -->
<fieldset>
  <legend>Choose Style</legend>
  <label><input type="radio" name="style" value="bw"> B&W</label>
  <label><input type="radio" name="style" value="color"> Color</label>
</fieldset>
```

**Why native elements**:
- Free keyboard navigation
- Free screen reader support
- Free focus management
- Less JavaScript
- Better performance

---

### Error Prevention

**Reduce User Errors**:

```
1. Clear Labels
   ✅ "Pet Name (e.g., Buddy)"
   ❌ "Name"

2. Input Constraints
   <input type="text"
          pattern="[A-Za-z0-9, \-']+"
          maxlength="50"
          title="Letters, numbers, commas, hyphens, and apostrophes only">

3. Real-Time Validation
   - Prevent invalid characters (e.g., @ in pet name)
   - Show character count: "25/50 characters"

4. Confirmation for Destructive Actions
   User switches from 3 pets → 1 pet
   → "This will remove data for pets 2-3. Continue?"

5. Auto-Save (localStorage)
   - Save form state every 5 seconds
   - Restore on page reload
   - Show indicator: "Draft saved 2 minutes ago"

6. Undo Actions (nice-to-have)
   User deletes pet photo
   → Toast: "Photo removed. [Undo]" (5 seconds)
```

---

## 10. Performance Optimization

### Lazy Loading

**Images**:

```html
<!-- Style/Font Card Preview Images -->
<img src="preview-modern.jpg"
     alt="Modern effect example"
     loading="lazy"
     decoding="async"
     width="180"
     height="160">

<!-- Uploaded Pet Thumbnails -->
<img src="https://storage.googleapis.com/..."
     alt="Pet preview"
     loading="lazy"
     decoding="async">
```

**Why**:
- Images below fold don't load until scrolled
- Saves bandwidth (especially mobile)
- Faster initial page load

---

### JavaScript Performance

**Debouncing**:

```javascript
// Pet name input updates font preview
let debounceTimer;
petNameInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateFontPreviews(e.target.value);
  }, 300); // Update after 300ms of no typing
});
```

**Why**:
- Reduces function calls (e.g., 10 keystrokes = 1 update, not 10)
- Smoves UI (no lag during typing)
- Less DOM manipulation

**Event Delegation**:

```javascript
// Instead of attaching event to each pet section (1-10)
document.querySelector('.pet-sections-container').addEventListener('click', (e) => {
  if (e.target.matches('[data-upload-trigger]')) {
    handleUpload(e.target);
  }
});

// Not this (creates 10 event listeners)
document.querySelectorAll('[data-upload-trigger]').forEach(btn => {
  btn.addEventListener('click', handleUpload);
});
```

**Why**:
- One event listener instead of 10
- Handles dynamically added elements
- Better memory usage

---

### CSS Performance

**Avoid Expensive Properties**:

```css
/* Good: GPU-accelerated */
.style-card {
  transform: translateY(-2px);
  will-change: transform;
}

/* Bad: Triggers layout reflow */
.style-card {
  margin-top: -2px;
}

/* Good: Opacity transition */
.fade-in {
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* Bad: Display transition (not animatable) */
.fade-in {
  display: none;
  transition: display 0.3s ease; /* Doesn't work */
}
```

**Critical CSS**:

```html
<head>
  <style>
    /* Inline critical CSS for above-fold content */
    .pet-selector-container { ... }
    .pet-count-selector { ... }
    .pet-section { ... }
  </style>

  <!-- Load full stylesheet async -->
  <link rel="preload" href="pet-selector.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
</head>
```

---

### Image Optimization

**Preview Images** (style/font cards):

```
Format: WebP (with JPEG fallback)
Dimensions: 360px × 320px (2x for retina)
Quality: 80% (good balance)
File Size Target: < 50KB each

<picture>
  <source srcset="preview-modern.webp" type="image/webp">
  <img src="preview-modern.jpg" alt="Modern effect" loading="lazy">
</picture>
```

**Uploaded Pet Thumbnails**:

```
Server-side processing:
1. Resize to 160px × 160px (thumbnail)
2. Compress to ~20KB
3. Convert to WebP
4. Store in GCS

Client-side display:
<img src="https://storage.googleapis.com/.../thumb_pet.webp"
     srcset="...thumb_pet.webp 1x, ...thumb_pet@2x.webp 2x"
     alt="Pet thumbnail"
     width="80"
     height="80"
     loading="lazy">
```

---

### Network Optimization

**Reduce HTTP Requests**:

```
Combine:
✅ All style card previews → Single sprite sheet (or use WebP with HTTP/2)
✅ All JavaScript → pet-selector-bundle.js
✅ All CSS → pet-selector.css

Use HTTP/2:
✅ Allows parallel requests (no need to combine everything)
✅ Server push for critical resources

Prefetch:
<link rel="prefetch" href="/cart" as="document">
<!-- Prefetch cart page while user fills form -->
```

**Caching**:

```html
<meta http-equiv="Cache-Control" content="public, max-age=31536000">
<!-- Cache static assets for 1 year -->

<!-- For dynamic content -->
<meta http-equiv="Cache-Control" content="no-cache, must-revalidate">
```

---

### localStorage Optimization

**Auto-Save Form State**:

```javascript
// Save state every 5 seconds (debounced)
let saveTimer;
function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem('petSelectorDraft', JSON.stringify(window.petSelectorState));
  }, 5000);
}

// Restore on page load
window.addEventListener('DOMContentLoaded', () => {
  const draft = localStorage.getItem('petSelectorDraft');
  if (draft) {
    window.petSelectorState = JSON.parse(draft);
    restoreFormState(window.petSelectorState);
  }
});

// Clear draft on successful cart add
function onAddToCartSuccess() {
  localStorage.removeItem('petSelectorDraft');
}
```

**Why**:
- Prevents data loss (browser crash, accidental close)
- Better UX (restore work on revisit)
- No server dependency

**Storage Limits**:
- localStorage limit: ~5-10MB (browser-dependent)
- Our usage: ~100KB max (10 pets × ~10KB each)
- Safe margin: Well within limits

---

## 11. Priority & Implementation Order

### Phase 1: Foundation (Must-Have)

**Week 1 - Core Structure**:

1. ✅ Update `ks-product-pet-selector.liquid`:
   - Pet count selector (1-10 buttons)
   - Basic pet sections (accordion on mobile)
   - Style selector (4 cards, static previews)
   - Font selector (6 cards)
   - Add to Cart button (disabled by default)

2. ✅ Create preview images:
   - 4 style preview images (B&W, Color, Modern, Sketch)
   - Optimize to WebP (~50KB each)
   - Upload to Shopify assets

3. ✅ Basic JavaScript:
   - Pet count selection → Show/hide sections
   - Style/font card selection
   - Form validation (basic)
   - Add to Cart data collection

**Deliverable**: Working UI with static previews, no upload functionality yet

---

### Phase 2: Upload & Validation (Must-Have)

**Week 2 - Core Functionality**:

1. ✅ File upload implementation:
   - Upload button triggers file picker
   - Client-side validation (size, type)
   - Progress bar during upload
   - Thumbnail display after upload

2. ✅ Server-side integration:
   - Upload endpoint (POST to GCS)
   - Return GCS URL
   - Error handling

3. ✅ Validation system:
   - Real-time field validation
   - Form-level validation
   - Error messages (inline + summary)
   - Enable/disable Add to Cart

**Deliverable**: Fully functional upload and validation

---

### Phase 3: Previous Order Integration (Must-Have)

**Week 3 - Order Lookup**:

1. ✅ "Use Existing Perkie Print" checkbox:
   - Expand/collapse order number input
   - Format validation (real-time)
   - API call to lookup order
   - Fetch pet image from order
   - Replace upload with thumbnail

2. ✅ Error handling:
   - Order not found
   - Order has no images
   - Network errors

**Deliverable**: Complete previous order workflow

---

### Phase 4: Polish & Optimization (Should-Have)

**Week 4 - UX Enhancements**:

1. ✅ Mobile optimizations:
   - Sticky Add to Cart button
   - Touch feedback animations
   - Improved scrolling behavior
   - Keyboard optimizations

2. ✅ Accessibility:
   - ARIA labels
   - Keyboard navigation
   - Screen reader testing
   - Focus management

3. ✅ Performance:
   - Image lazy loading
   - JavaScript debouncing
   - localStorage auto-save
   - Critical CSS inlining

**Deliverable**: Production-ready, accessible, performant UI

---

### Phase 5: Nice-to-Have Features (Future)

**Post-Launch Enhancements**:

1. 🔲 Preview modal:
   - Tap style card → Show full-size preview
   - Swipe between styles
   - Close button

2. 🔲 Multi-file upload:
   - Drag-and-drop (desktop)
   - Bulk upload (select 3 files at once)
   - Batch progress indicator

3. 🔲 AI-assisted cropping:
   - Auto-detect pet in photo
   - Suggest crop area
   - Preview before upload

4. 🔲 Font preview with actual pet image:
   - After upload, show font on customer's pet
   - More accurate preview
   - Higher conversion

5. 🔲 Undo/redo functionality:
   - Undo pet deletion
   - Undo style change
   - Toast notification with "Undo" button

6. 🔲 Social proof:
   - "1,247 customers created custom portraits this week"
   - Display below Add to Cart button

**Priority**: Low (launch without these, add based on user feedback)

---

### Testing Checklist (Before Launch)

**Functional Testing**:
- [ ] Pet count selector (1-10) works
- [ ] Accordion expands/collapses (mobile)
- [ ] File upload works (all formats)
- [ ] File validation catches errors
- [ ] Style selection updates state
- [ ] Font selection updates preview
- [ ] Previous order lookup works
- [ ] Add to Cart validation works
- [ ] Cart data is correct
- [ ] localStorage saves/restores

**Cross-Browser Testing**:
- [ ] Chrome (latest)
- [ ] Safari (iOS + macOS)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Samsung Internet (Android)

**Device Testing**:
- [ ] iPhone SE (small screen)
- [ ] iPhone 12/13/14 (standard)
- [ ] iPhone 14 Pro Max (large)
- [ ] Samsung Galaxy S21 (Android)
- [ ] iPad (tablet)
- [ ] Desktop (1920×1080)

**Accessibility Testing**:
- [ ] Keyboard navigation works
- [ ] Screen reader (NVDA/JAWS)
- [ ] Color contrast passes
- [ ] Touch targets ≥ 44px
- [ ] Focus indicators visible

**Performance Testing**:
- [ ] Initial load < 3 seconds (3G)
- [ ] Images lazy load
- [ ] No layout shift (CLS < 0.1)
- [ ] Smooth animations (60fps)

---

## 12. Edge Cases & Solutions

### Edge Case 1: User Switches Pet Count (Data Loss)

**Scenario**:
User fills in 3 pets (names + photos), then switches to 1 pet.

**Problem**:
Data for pets 2-3 will be lost if we immediately remove sections.

**Solution**:
```javascript
function handlePetCountChange(newCount, oldCount) {
  if (newCount < oldCount) {
    // Check if removed pets have data
    const hasData = window.petSelectorState.pets
      .slice(newCount)
      .some(pet => pet.name || pet.imageUrl);

    if (hasData) {
      // Show confirmation dialog
      const confirmed = confirm(
        `You have data for ${oldCount} pets. ` +
        `Switching to ${newCount} pet${newCount > 1 ? 's' : ''} ` +
        `will remove data for pets ${newCount + 1}-${oldCount}. Continue?`
      );

      if (!confirmed) {
        // Revert pet count selection
        setPetCount(oldCount);
        return;
      }
    }
  }

  // Proceed with count change
  updatePetSections(newCount);
}
```

**UX**:
- Clear warning before data loss
- User can cancel and keep current state
- No surprise data deletion

---

### Edge Case 2: 10 Pet Names in Font Preview

**Scenario**:
User selects 10 pets. Font preview shows "Buddy, Lucy, Max, Charlie, Daisy, Rocky, Bella, Max, Cooper, Luna".

**Problem**:
- Text overflows card (300+ characters)
- Unreadable on mobile
- Breaks layout

**Solution**:
```javascript
function formatPetNamesForPreview(names, maxVisible = 3) {
  if (names.length <= maxVisible) {
    return names.join(', ');
  }

  const visible = names.slice(0, maxVisible);
  const remaining = names.length - maxVisible;

  return `${visible.join(', ')}, +${remaining} more`;
}

// Usage:
// 3 pets: "Buddy, Lucy, Max"
// 5 pets: "Buddy, Lucy, Max, +2 more"
// 10 pets: "Buddy, Lucy, Max, +7 more"
```

**Mobile Adaptation**:
```css
.font-card-preview {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

---

### Edge Case 3: Very Long Pet Name

**Scenario**:
User enters "Sir Fluffington the Third of Barkshire" (40+ characters).

**Problem**:
- Overflows font preview cards
- Breaks accordion header layout
- Unreadable in small spaces

**Solution 1: Truncate with Ellipsis**
```javascript
function truncatePetName(name, maxLength = 20) {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + '...';
}

// Display: "Sir Fluffington the..."
// Full name stored in data attribute for tooltip
```

**Solution 2: Character Limit**
```html
<input type="text"
       name="pet_name"
       maxlength="30"
       title="Maximum 30 characters">
```

**Recommended**: Use both (enforce limit + graceful truncation for display)

---

### Edge Case 4: Slow Network During Upload

**Scenario**:
User uploads 5MB photo on 3G connection (30+ seconds).

**Problem**:
- User thinks page is frozen
- User refreshes page (loses progress)
- Frustration, abandonment

**Solution**:
```javascript
let uploadTimeout;

function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  // Show progress immediately
  showUploadProgress(0);

  // Set timeout warning (10 seconds)
  uploadTimeout = setTimeout(() => {
    showSlowNetworkWarning();
  }, 10000);

  // Upload with progress tracking
  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      updateUploadProgress(percent);
    }
  });

  xhr.addEventListener('load', () => {
    clearTimeout(uploadTimeout);
    hideSlowNetworkWarning();
    handleUploadSuccess(xhr.response);
  });

  xhr.open('POST', '/upload');
  xhr.send(formData);
}

function showSlowNetworkWarning() {
  const warning = document.createElement('div');
  warning.className = 'upload-warning';
  warning.innerHTML = `
    ⏳ <strong>Slow connection detected.</strong><br>
    Upload is still in progress. Please don't close this page.
  `;
  document.querySelector('.upload-progress').appendChild(warning);
}
```

**UX**:
- Immediate feedback (0% progress shown)
- Warning after 10 seconds (manage expectations)
- Clear instruction (don't close page)
- Cancel button option

---

### Edge Case 5: Order Number Lookup Returns Multiple Pets

**Scenario**:
User enters order #1001 which had 3 pets. They want pet #2 from that order.

**Problem**:
- Which pet do we fetch?
- User can't specify which one

**Solution 1: Fetch All, Let User Choose**
```javascript
async function fetchPreviousOrder(orderNumber, petIndex) {
  const response = await fetch(`/api/orders/${orderNumber}/pets`);
  const data = await response.json();

  if (data.pets.length > 1) {
    // Show selection modal
    showPetSelectionModal(data.pets, petIndex);
  } else {
    // Only one pet, use it
    setPetImage(petIndex, data.pets[0].imageUrl);
  }
}

function showPetSelectionModal(pets, targetIndex) {
  const modal = `
    <div class="modal">
      <h3>Select Pet from Order</h3>
      <div class="pet-grid">
        ${pets.map((pet, i) => `
          <button class="pet-option" data-pet-index="${i}">
            <img src="${pet.thumbnailUrl}" alt="${pet.name}">
            <span>${pet.name || `Pet ${i + 1}`}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  // Show modal, wait for selection
}
```

**Solution 2: Use Positional Mapping (Simpler)**
```javascript
// Assume pet position matches
// If user enters order number in "Pet 2" section, fetch pet #2 from that order
async function fetchPreviousOrder(orderNumber, petIndex) {
  const response = await fetch(`/api/orders/${orderNumber}/pets`);
  const data = await response.json();

  // Use same position (1-indexed to 0-indexed)
  const pet = data.pets[petIndex - 1];

  if (pet) {
    setPetImage(petIndex, pet.imageUrl);
  } else {
    showError(`Order #${orderNumber} only has ${data.pets.length} pet(s).`);
  }
}
```

**Recommended**: Solution 2 (simpler, matches user mental model)

---

### Edge Case 6: Browser Back Button After Upload

**Scenario**:
1. User uploads 3 pet photos
2. User clicks "Back" button (accidentally)
3. User returns to page
4. All uploads are gone

**Problem**:
- Frustrating re-upload experience
- Data loss
- Increased abandonment

**Solution: localStorage Auto-Save**
```javascript
// Save state on every significant change
function saveFormState() {
  const state = {
    petCount: window.petSelectorState.petCount,
    pets: window.petSelectorState.pets.map(pet => ({
      name: pet.name,
      imageUrl: pet.imageUrl,
      previousOrderNumber: pet.previousOrderNumber
    })),
    selectedStyle: window.petSelectorState.selectedStyle,
    selectedFont: window.petSelectorState.selectedFont,
    timestamp: Date.now()
  };

  localStorage.setItem('petSelectorDraft', JSON.stringify(state));
}

// Restore state on page load
window.addEventListener('DOMContentLoaded', () => {
  const draft = localStorage.getItem('petSelectorDraft');
  if (!draft) return;

  const state = JSON.parse(draft);

  // Check if draft is recent (< 24 hours old)
  const hoursSince = (Date.now() - state.timestamp) / (1000 * 60 * 60);
  if (hoursSince > 24) {
    localStorage.removeItem('petSelectorDraft');
    return;
  }

  // Restore form
  setPetCount(state.petCount);
  state.pets.forEach((pet, index) => {
    setPetName(index, pet.name);
    setPetImage(index, pet.imageUrl);
    // ...
  });

  // Show notification
  showNotification('✅ Your previous work has been restored!');
});

// Clear draft on successful cart add
function onAddToCartSuccess() {
  localStorage.removeItem('petSelectorDraft');
}
```

**UX**:
- Automatic save (no user action needed)
- Restores on return (even after back button)
- Clear indication ("Work restored")
- Clears after 24 hours (no stale data)

---

### Edge Case 7: User Selects "Blank" Font But Enters Pet Names

**Scenario**:
1. User enters pet names: "Buddy, Lucy, Max"
2. User selects "Blank" font (no text on product)
3. User adds to cart

**Problem**:
- Conflicting data (names provided but font says no text)
- Employee confusion during fulfillment
- Should we print names or not?

**Solution 1: Clear Conflict**
```javascript
// When "Blank" font is selected, clear pet name inputs
fontBlankRadio.addEventListener('change', () => {
  if (fontBlankRadio.checked) {
    // Show confirmation if names already entered
    const hasNames = petNameInputs.some(input => input.value.trim());

    if (hasNames) {
      const confirmed = confirm(
        'Selecting "Blank" will remove pet names from your product. ' +
        'Names will not be printed. Continue?'
      );

      if (!confirmed) {
        // Revert to previously selected font
        revertFontSelection();
        return;
      }
    }

    // Clear all name inputs
    petNameInputs.forEach(input => {
      input.value = '';
      input.disabled = true;
    });

    // Update cart data
    window.petSelectorState.selectedFont = 'no-text';
  }
});

// When other font selected, re-enable name inputs
otherFontRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    petNameInputs.forEach(input => {
      input.disabled = false;
    });
  });
});
```

**Solution 2: Visual Indication (Simpler)**
```javascript
// Just make it clear in cart data
function buildCartData() {
  return {
    petNames: window.petSelectorState.selectedFont === 'no-text'
      ? []
      : window.petSelectorState.pets.map(p => p.name),
    selectedFont: window.petSelectorState.selectedFont,
    // ...
  };
}
```

**Recommended**: Solution 1 (prevents confusion, clear UX)

---

### Edge Case 8: Product Has No Text Metafield

**Scenario**:
Product is a pet portrait (no text ever printed), but font selector still appears.

**Problem**:
- Confusing to user (why select font if no text?)
- Wasted UI space
- Unnecessary decision

**Solution: Conditional Rendering**
```liquid
{% assign has_text = product.metafields.custom.has_text | default: true %}

{% if has_text %}
  {% render 'pet-font-selector', section_id: section.id %}
{% else %}
  <!-- No font selector shown -->
  <!-- Cart data automatically sets selectedFont to null -->
{% endif %}
```

**JavaScript Handling**:
```javascript
// Check if font selector exists before validating
function validateForm() {
  const errors = [];

  // ... other validation

  const fontSelector = document.querySelector('.font-selector');
  if (fontSelector && !window.petSelectorState.selectedFont) {
    errors.push('Choose a font style');
  }

  return { isValid: errors.length === 0, errors };
}
```

---

## 13. Success Metrics

### Key Performance Indicators (KPIs)

**Primary Metrics** (Track weekly):

1. **Conversion Rate**:
   ```
   (Users who complete selector → Add to Cart) / (Users who view selector)

   Target: 45-55% (baseline to establish)
   Benchmark: Industry average ~35-40% for custom products
   ```

2. **Average Time to Complete**:
   ```
   Time from "Number of Pets" selection → "Add to Cart" click

   Target: < 3 minutes (1 pet), < 5 minutes (3 pets)
   Current: Unknown (establish baseline)
   ```

3. **Error Rate**:
   ```
   (Users who see validation errors) / (Total users)

   Target: < 20%
   Goal: Most users complete form correctly first try
   ```

4. **Upload Success Rate**:
   ```
   (Successful uploads) / (Upload attempts)

   Target: > 95%
   Issues: Network errors, invalid files, size limits
   ```

**Secondary Metrics** (Track monthly):

5. **Pet Count Distribution**:
   ```
   1 pet: XX%
   2 pets: XX%
   3 pets: XX%
   4+ pets: XX%

   Purpose: Understand product-market fit
   Action: Optimize UI for most common count
   ```

6. **Style Selection Distribution**:
   ```
   B&W: XX%
   Color: XX%
   Modern: XX%
   Sketch: XX%

   Purpose: Understand style preferences
   Action: Consider removing unpopular styles
   ```

7. **Font Selection Distribution**:
   ```
   Preppy: XX%
   Classic: XX%
   Playful: XX%
   Elegant: XX%
   Trend: XX%
   Blank: XX%

   Purpose: Font popularity
   Action: Optimize preview for popular fonts
   ```

8. **"Use Existing" Adoption Rate**:
   ```
   (Users who use previous order) / (Total users)

   Target: 10-15% (repeat customer rate)
   Purpose: Measure customer loyalty
   ```

---

### Analytics Events (Google Analytics 4)

**Event Tracking**:

```javascript
// Pet count selected
gtag('event', 'pet_count_selected', {
  event_category: 'pet_selector',
  event_label: 'count',
  value: petCount // 1-10
});

// Pet section completed
gtag('event', 'pet_section_completed', {
  event_category: 'pet_selector',
  event_label: 'pet_number',
  value: petNumber // 1-10
});

// File upload started
gtag('event', 'upload_started', {
  event_category: 'pet_selector',
  event_label: 'upload',
  value: fileSize // in MB
});

// File upload completed
gtag('event', 'upload_completed', {
  event_category: 'pet_selector',
  event_label: 'upload',
  value: uploadTimeSeconds
});

// Style selected
gtag('event', 'style_selected', {
  event_category: 'pet_selector',
  event_label: 'style',
  value: styleName // 'bw', 'color', 'modern', 'sketch'
});

// Font selected
gtag('event', 'font_selected', {
  event_category: 'pet_selector',
  event_label: 'font',
  value: fontName // 'preppy', 'classic', etc.
});

// Previous order used
gtag('event', 'previous_order_used', {
  event_category: 'pet_selector',
  event_label: 'order_lookup',
  value: 1
});

// Validation error
gtag('event', 'validation_error', {
  event_category: 'pet_selector',
  event_label: 'error_type',
  value: errorMessage // 'missing_name', 'missing_image', etc.
});

// Add to cart success
gtag('event', 'add_to_cart', {
  event_category: 'ecommerce',
  event_label: 'pet_selector',
  value: totalPrice,
  items: [{
    item_id: productId,
    item_name: productName,
    price: totalPrice,
    quantity: 1,
    item_category: 'custom_pet_product'
  }]
});

// Form abandonment
window.addEventListener('beforeunload', () => {
  if (isFormPartiallyComplete()) {
    gtag('event', 'form_abandoned', {
      event_category: 'pet_selector',
      event_label: 'abandonment',
      value: completionPercentage // 0-100
    });
  }
});
```

---

### A/B Test Hypotheses (Post-Launch)

**Test 1: Pet Count Layout**

```
Variant A: Horizontal scrollable buttons (current design)
Variant B: Dropdown selector

Hypothesis: Buttons will have higher completion rate (easier to tap)
Metric: Conversion rate
Duration: 2 weeks
Sample size: 1,000 users per variant
```

**Test 2: Upload Button Copy**

```
Variant A: "📸 Upload Photo" (current)
Variant B: "📸 Choose Pet Photo"
Variant C: "📸 Add Your Pet"

Hypothesis: "Add Your Pet" feels more personal, increases uploads
Metric: Upload success rate
Duration: 1 week
Sample size: 500 users per variant
```

**Test 3: Style Selector Layout**

```
Variant A: 2x2 grid with previews (current)
Variant B: 1x4 row with larger previews

Hypothesis: Larger previews increase style engagement (more clicks)
Metric: Time to select style
Duration: 2 weeks
Sample size: 1,000 users per variant
```

**Test 4: Font Preview Size**

```
Variant A: 16px font preview (current)
Variant B: 20px font preview (larger)

Hypothesis: Larger preview reduces font selection errors
Metric: Font selection time + error rate
Duration: 1 week
Sample size: 500 users per variant
```

---

### User Feedback Collection

**Post-Purchase Survey** (via email):

```
Subject: How was your experience creating [Product Name]?

Question 1: How easy was it to customize your pet product?
□ Very easy
□ Easy
□ Neutral
□ Difficult
□ Very difficult

Question 2: What was the most confusing part? (Optional)
[Text box]

Question 3: What would make the experience better? (Optional)
[Text box]

Question 4: Would you recommend our customization tool to a friend?
□ Definitely
□ Probably
□ Not sure
□ Probably not
□ Definitely not
```

**Exit Survey** (if user abandons):

```
Popup after 60 seconds of inactivity:

"We noticed you haven't completed your order.
Can you tell us why? (Optional)"

□ Too expensive
□ Too complicated
□ Didn't like the styles
□ Just browsing
□ Other: [Text box]

[Submit] [No thanks]
```

---

### Performance Benchmarks

**Page Load Speed**:
```
Target: < 3 seconds (3G network)
Measure: Google PageSpeed Insights
Metrics:
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
```

**Upload Performance**:
```
Target: < 10 seconds for 5MB file (WiFi)
Target: < 30 seconds for 5MB file (3G)
Measure: Upload analytics (time tracking)
```

**Form Validation Speed**:
```
Target: < 100ms (imperceptible to user)
Measure: JavaScript performance.now()
```

---

## Appendix: Quick Reference

### Mobile Touch Target Sizes

| Element | Mobile Size | Desktop Size | WCAG Compliant |
|---------|-------------|--------------|----------------|
| Pet count button | 60×44px | 50×40px | ✅ Yes |
| Upload button | Full width × 48px | 200×48px | ✅ Yes |
| Style card | 155×140px | 180×160px | ✅ Yes |
| Font card | 100×90px | 140×100px | ✅ Yes |
| Checkbox | 24×24px + 20px padding | Same | ✅ Yes |
| Add to Cart button | Full width × 56px | 400×56px | ✅ Yes |

---

### Breakpoint Summary

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile Small | < 375px | 3x2 font grid, smaller text |
| Mobile Medium | 375-749px | Standard mobile layout |
| Tablet | 750-999px | No accordion, 4×1 style grid |
| Desktop | 1000-1199px | 6×1 font grid, max-width 800px |
| Large Desktop | ≥ 1200px | Two-column layout (optional) |

---

### Color Palette Reference

| Use Case | Light Mode | Dark Mode (Future) |
|----------|------------|-------------------|
| Selected state | #10b981 (Green) | #34d399 |
| Hover state | #3b82f6 (Blue) | #60a5fa |
| Error state | #ef4444 (Red) | #f87171 |
| Text primary | #1a1a1a | #f5f5f5 |
| Text secondary | #666666 | #a3a3a3 |
| Border | #e0e0e0 | #404040 |
| Background | #ffffff | #1a1a1a |

---

### Data Structure Reference

**localStorage Format**:
```json
{
  "petSelectorDraft": {
    "petCount": 3,
    "pets": [
      {
        "id": "pet_1",
        "name": "Buddy",
        "imageSource": "upload",
        "imageUrl": "https://storage.googleapis.com/...",
        "previousOrderNumber": "",
        "artistNote": "Customer note from pet processor",
        "isComplete": true
      }
    ],
    "selectedStyle": "modern",
    "selectedFont": "preppy",
    "timestamp": 1698765432000
  }
}
```

**Cart Properties Format**:
```json
{
  "properties": {
    "_pet_count": 3,
    "_pet_names": "Buddy, Lucy, Max",
    "_pet_images": "https://..., https://..., https://...",
    "_selected_style": "modern",
    "_selected_font": "preppy",
    "_artist_notes": "Note 1||Note 2||Note 3",
    "_previous_orders": "||#1001||"
  }
}
```

---

## Implementation Notes

### Critical Reminders

1. **DO NOT CODE**: This is a UX implementation plan only
2. **Mobile-first**: 70% of traffic is mobile - prioritize mobile UX
3. **Accessibility**: WCAG 2.1 AA minimum - test with screen readers
4. **Performance**: Lazy load images, debounce inputs, optimize uploads
5. **Error handling**: Clear messages, graceful degradation, auto-save
6. **Testing**: Test on real devices before launch (not just emulators)

### Next Steps for Developer

1. Read this entire plan
2. Ask UX designer for clarifications (if any)
3. Create HTML/CSS mockup (static, no JS)
4. Review mockup with stakeholders
5. Implement JavaScript functionality (phase by phase)
6. Test on Shopify test URL (Chrome DevTools MCP)
7. Accessibility audit (keyboard nav, screen reader)
8. Performance audit (PageSpeed Insights)
9. Deploy to production
10. Monitor metrics for 2 weeks

---

**End of UX Implementation Plan**
**Total Pages**: 13 sections, ~15,000 words
**Estimated Reading Time**: 60-90 minutes
**Implementation Time**: 4 weeks (4 phases)
**Reviewed by**: UX Design E-commerce Expert Agent
**Date**: 2025-11-02
**Status**: Ready for implementation
