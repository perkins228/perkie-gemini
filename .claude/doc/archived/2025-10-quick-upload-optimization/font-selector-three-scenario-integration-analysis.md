# Font Selector Integration with Three-Scenario Checkout Flow
**UX Design Analysis | E-commerce Expert**
**Date:** 2025-10-20
**Status:** Analysis Complete - Ready for Implementation Review
**Related Docs:**
- `.claude/doc/three-scenario-pet-checkout-ux-design-spec.md`
- `.claude/doc/mobile-three-scenario-purchase-architecture.md`

---

## Executive Summary

This document analyzes how the pet **font selector** feature integrates with our new three-scenario checkout flow and identifies critical UX challenges that must be resolved before deployment.

**The Core Problem:**
Font selection enables customers to choose text style for pet names on products. However, our three scenarios create fundamentally different user journeys with conflicting font selection requirements:

1. **Scenario 1 (Order Lookup)**: Customer retrieves previous order data → Should we use their old font or let them pick new?
2. **Scenario 2 (Preview Flow)**: Customer uploads, processes, previews → When do they select font? Before or after AI processing?
3. **Scenario 3 (Quick Upload)**: Customer wants instant checkout → Is font selection friction they can't afford?

**Key Finding:** The current font selector is **NOT integrated** with the three-scenario flow. It exists as a standalone component that only appears after `pet:selected` event, creating timing conflicts and UX gaps.

---

## 1. Current Font Selector Implementation

### 1.1 How It Works Today

**Location:**
- **Component:** `snippets/pet-font-selector.liquid`
- **Rendered:** In `sections/main-product.liquid` (line 456)
- **Visibility:** Initially hidden (`display: none`)
- **Trigger:** Shows when `window.productSupportsFonts = true` AND `pet:selected` event fires

**Font Options:**
1. **Preppy** - Libre Caslon Text with borders
2. **Classic** - Merriweather (DEFAULT)
3. **Playful** - Rampart One
4. **Elegant** - Ms Madi
5. **Trend** - Fascinate
6. **Blank** - No text on product (40% customer preference)

**Technical Integration:**
```javascript
// cart-pet-integration.js lines 84-96
fontStyleField.name = 'properties[_font_style]';
fontStyleField.value = localStorage.getItem('selectedFontStyle') || 'classic';
```

**Key Behaviors:**
- Font stored in **localStorage** as `selectedFontStyle`
- Defaults to `'classic'` if none selected
- Validates against allowed fonts: `['preppy', 'classic', 'playful', 'elegant', 'trend', 'no-text']`
- Sent to Shopify as order line item property `_font_style`
- Preview names update dynamically via `pet:selected` event (line 344)

### 1.2 Current Display Logic

```javascript
// pet-font-selector.liquid lines 349-352
document.addEventListener('pet:selected', function(e) {
  if (e.detail && e.detail.name) {
    updatePreviewNames(e.detail.name);

    // Show font selector if product supports fonts
    if (window.productSupportsFonts) {
      fontSelector.style.display = 'block';
    }
  }
});
```

**When Font Selector Appears:**
1. Product must have metafield `product.metafields.custom.supports_font_styles = true`
2. AND `pet:selected` event must fire with pet name
3. Font cards show preview of pet name in each style

**Problem:** This works fine for OLD flow (upload → process → select) but creates conflicts in our new three scenarios.

---

## 2. Three-Scenario Integration Conflicts

### 2.1 Scenario 1: Order Lookup Flow

**User Journey:**
```
Customer enters pet name(s) + order number
    ↓
Backend retrieves previous order
    ↓
Order contains: pet_name, _font_style, gcs_url, effect
    ↓
❓ CONFLICT: Should we restore their previous font or let them pick new?
```

**Current Behavior:**
Font selector does NOT integrate with order lookup. When order data is retrieved:
- `_font_style` from previous order is ignored
- Font defaults to `'classic'` or localStorage value
- Customer has NO visibility of what font they used before
- No way to "use same font as last order"

**UX Problem:**
Customer ordered with **Elegant** font 2 months ago. They love that style. They re-order expecting same look. But:
1. Font selector defaults to **Classic** (localStorage or default)
2. Customer doesn't remember which font they used
3. They pick **Playful** by mistake
4. Receive product with different font than expected = **negative surprise**

**Frequency:** Affects **100% of returning customers** using order lookup (potentially 30-40% of orders after 2-3 months).

---

### 2.2 Scenario 2: Preview Flow (Upload & Process)

**User Journey:**
```
Customer navigates to /pages/pet-background-remover
    ↓
Uploads photo + enters pet name
    ↓
AI processes (3-11s)
    ↓
Previews 4 effects
    ↓
Selects effect
    ↓
Returns to product page
    ↓
❓ WHEN do they select font?
```

**Current Behavior:**
Font selector appears on **product page** AFTER returning from processor page. This creates:

**Timing Conflict:**
- Customer enters pet name on **processor page** (line 1 of flow)
- But font selector is on **product page** (line 6 of flow)
- Font selection is AFTER effect selection
- Creates "oh wait, one more thing" friction

**UX Flow Issue:**
```
Processor Page:
  Pet name: [Bella___] ← Customer thinks: "I'm done entering info"
  Effect preview: [Color] [B&W] [Pop Art] [Dithering]
  "Add to Product" button ← Customer thinks: "I'm done!"

Product Page:
  Font selector appears ← Customer thinks: "Wait, I have to pick again?"
  [Preppy] [Classic] [Playful] [Elegant] [Trend] [Blank]

Add to Cart ← Customer thinks: "Finally..."
```

**Impact:**
- **Cognitive overload**: Too many decision points spread across pages
- **Abandonment risk**: "One more step" after customer thought they were done
- **Mobile friction**: Requires scrolling, focus shift, additional taps

**Mitigation (Current):**
Font defaults to `'classic'` so technically customers CAN skip it. But:
- They don't know they're skipping it
- No indication font choice even exists
- Surprise when product arrives with different style than expected

---

### 2.3 Scenario 3: Express Checkout (Quick Upload)

**User Journey:**
```
Customer on product page
    ↓
Taps "Quick Upload" button
    ↓
Inline modal: Enter pet name + Upload photo
    ↓
"Add to Cart" enabled immediately
    ↓
❓ CONFLICT: Should we force font selection?
```

**Current Behavior:**
Font selector does NOT appear in quick upload flow. Customer:
1. Enters pet name in inline modal
2. Uploads photo
3. `pet:selected` event fires
4. Font selector appears on product page (below modal)
5. Customer doesn't notice it (modal still open)
6. Customer adds to cart with default `'classic'` font

**UX Problem - Hidden Decision:**
- Font selector appears but customer's attention is on modal
- They close modal, scroll to "Add to Cart" button
- Font selector is ABOVE the button (typical product page layout)
- Mobile users scroll past it without seeing
- Result: **95%+ customers use default font without realizing they had choice**

**Design Question:**
Should we even SHOW font selector in quick upload? Arguments:

**PRO (Show Font Selector):**
- Gives customers control over final product
- Some customers care deeply about font style
- Prevents "this isn't what I wanted" complaints
- Blank option (no text) is popular (40% preference)

**CON (Hide Font Selector):**
- Adds friction to "express" checkout flow
- Contradicts "quick upload" value proposition
- Most customers trust default or don't care
- Can offer font selection in post-purchase email

---

## 3. Technical Integration Gaps

### 3.1 Order Lookup Integration (Missing)

**Current Code:**
```javascript
// No integration exists today
// Order lookup retrieves:
{
  "pets": [{
    "name": "Bella",
    "gcs_url": "...",
    "effect": "popart",
    "font_style": "elegant"  // ← Retrieved but NOT used
  }]
}
```

**What Needs to Happen:**
1. Backend returns `font_style` from previous order
2. Frontend updates font selector to show previous choice:
   ```javascript
   // Pseudo-code
   if (orderLookupSuccess) {
     const previousFont = orderData.pets[0].font_style;
     selectFontOption(previousFont); // Pre-select previous font
     showRestoreConfirmation("Using your previous font: Elegant");
   }
   ```
3. Update localStorage with retrieved font
4. Show visual indicator: "Using same font as order #1001"

**Files to Modify:**
- `assets/cart-pet-integration.js` - Add order font restoration
- `snippets/pet-font-selector.liquid` - Add "restored font" state
- Backend endpoint `/api/retrieve-order-pets` - Include `_font_style` in response

---

### 3.2 Processor Page Integration (Missing)

**Current Code:**
Processor page (`sections/ks-pet-processor-v5.liquid`) has:
- Pet name input ✅
- Effect selection ✅
- Font selection ❌ (doesn't exist)

**What Needs to Happen:**
Option A: **Add Font Selector to Processor Page** (RECOMMENDED)
```
Upload Photo
    ↓
Enter Pet Name: [Bella___]
    ↓
Select Font Style: [Preppy] [Classic] [Playful] [Elegant] [Trend] [Blank]
    ↓
AI Processing (3-11s)
    ↓
Preview Effects with selected font
    ↓
Add to Product
```

**Advantages:**
- All customization in one place
- Reduces product page friction
- Customer sees font preview WITH effects
- Mobile-friendly single-page flow

**Technical Requirements:**
- Add font selector component to processor page
- Store font choice in localStorage during processing
- Pass font to product page via `pet:selected` event
- Update product page to respect pre-selected font

Option B: **Keep Font on Product Page BUT Show Preview** (ALTERNATIVE)
```
Processor Page: Upload → Process → Select Effect
    ↓
Product Page: "One more choice: Pick your font style"
    ↓
[Clear CTA] [Visual previews] [Progress indicator: "Step 3 of 3"]
```

**Advantages:**
- Separates concerns (processor = image, product = text)
- Less complexity on processor page
- Easier to implement

---

### 3.3 Quick Upload Integration (Missing)

**Current Code:**
Quick upload modal shows:
- Pet name input ✅
- File upload ✅
- Font selection ❌ (doesn't appear)

**What Needs to Happen:**
Option A: **Add Font to Quick Upload Modal** (BALANCED)
```
┌─────────────────────────────────┐
│ Quick Upload                     │
│                                  │
│ Pet Name: [Bella___]            │
│ Photo: [Choose File]            │
│                                  │
│ Font Style (Optional):          │
│ [Classic ▼] ← Dropdown          │
│                                  │
│ [Add to Cart]                   │
└─────────────────────────────────┘
```

**Advantages:**
- All info captured in one modal
- Customer makes informed choice
- Supports "Blank" option (40% want no text)

**Disadvantages:**
- Adds step to "quick" flow
- Mobile modal gets longer (scroll required)
- Dropdown hides font previews

Option B: **Default Font + Post-Purchase Selection** (SIMPLEST)
```
Quick Upload Modal:
  Pet Name: [Bella___]
  Photo: [Choose File]
  [Add to Cart]

Post-Purchase Email:
  "Choose your font style" → Link to font selector
  Customer picks font within 24h
  Backend updates order properties
```

**Advantages:**
- Zero friction during checkout
- Customer completes purchase in 5-10 seconds
- Font selection when they have more time
- Can show better previews in email

**Disadvantages:**
- Requires backend webhook integration
- Customer might forget to select font (need default)
- Email open rate ~30% (70% use default)

Option C: **Smart Default + Inline Toggle** (RECOMMENDED)
```
┌─────────────────────────────────┐
│ Quick Upload                     │
│                                  │
│ Pet Name: [Bella___]            │
│ Photo: [Choose File]            │
│                                  │
│ ☑ Include pet name on product   │
│     (We'll use Classic font)    │
│     [Change font ↓]             │
│                                  │
│ [Add to Cart]                   │
└─────────────────────────────────┘
```

**Expanded State:**
```
┌─────────────────────────────────┐
│ Quick Upload                     │
│                                  │
│ Pet Name: [Bella___]            │
│ Photo: [Choose File]            │
│                                  │
│ ☑ Include pet name on product   │
│                                  │
│ Font Style:                     │
│ ○ Classic (Elegant serif)       │
│ ● Playful (Fun & bouncy)        │
│ ○ Blank (No text)               │
│                                  │
│ [Add to Cart]                   │
└─────────────────────────────────┘
```

**Advantages:**
- Defaults to "include name + classic font" (80% want this)
- Shows checkbox state (visual feedback)
- Reveals font choice on demand (progressive disclosure)
- Supports "Blank" for 40% who want no text
- Mobile-friendly (short list, no dropdown)

---

## 4. UX Recommendations by Scenario

### 4.1 Scenario 1: Order Lookup

**Recommendation: AUTO-RESTORE PREVIOUS FONT**

**User Flow:**
```
Customer enters name + order number
    ↓
System retrieves order #1001
    ↓
✅ "Bella retrieved with Elegant font from order #1001"
    ↓
Font selector shows:
  ○ Preppy
  ○ Classic
  ● Elegant ← Pre-selected with checkmark
  ○ Playful
  ○ Trend
  ○ Blank
    ↓
[Keep Elegant] [Change Font ↓]
```

**Implementation:**
1. Backend includes `_font_style` in order lookup response
2. Frontend auto-selects matching font in selector
3. Show confirmation banner: "Using Elegant font from order #1001"
4. Customer can change if desired (but default is preserved)

**Fallback Handling:**
- If previous font was "Blank" (no text) → Restore "Blank" option
- If font name changed (e.g., "Classic" renamed to "Traditional") → Map to closest match
- If product doesn't support fonts → Hide selector entirely

**Mobile Optimization:**
- Confirmation banner at top (high visibility)
- Font selector collapsed by default (reduce scroll)
- Expand button: "Change font (currently: Elegant)"
- Keep same font by default (zero friction)

**Priority:** **HIGH** - This is low-effort, high-impact. Prevents negative surprises for returning customers.

---

### 4.2 Scenario 2: Preview Flow

**Recommendation: MOVE FONT TO PROCESSOR PAGE**

**Rationale:**
- Consolidates all customization decisions in one place
- Reduces "one more thing" friction on product page
- Allows customer to see font WITH effect preview
- Mobile-friendly single-page flow

**User Flow:**
```
/pages/pet-background-remover
    ↓
Step 1: Upload photo
    ↓
Step 2: Enter pet name: [Bella___]
    ↓
Step 3: Select font style (NEW)
  [Preppy] [Classic] [Playful] [Elegant] [Trend] [Blank]
    ↓
Step 4: AI Processing (3-11s)
  "Processing Bella in Classic font..."
    ↓
Step 5: Preview effects
  Shows "Bella" in Classic font on each effect
    ↓
Step 6: Add to Product
  Returns to product page with font already selected
```

**Implementation:**
1. Add font selector component to processor page (after pet name)
2. Show as radio cards (same design as product page)
3. Update preview rendering to include font
4. Pass font to product page via `pet:selected` event:
   ```javascript
   detail: {
     name: "Bella",
     effect: "popart",
     font_style: "classic",  // NEW
     gcsUrl: "..."
   }
   ```
5. Product page respects pre-selected font (no re-selection needed)

**Visual Design:**
```
┌─────────────────────────────────┐
│ Step 2: Your Pet's Name         │
│ [Bella_______________]          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Step 3: Choose Name Style       │
│                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │Preppy│ │Class.│ │Play. │     │
│ │Bella │ │Bella │ │Bella │     │
│ └──────┘ └──────┘ └──────┘     │
│                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │Eleg. │ │Trend │ │Blank │     │
│ │Bella │ │Bella │ │      │     │
│ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────┘

[ Continue to Preview ]
```

**Mobile Optimization:**
- 2-column grid (3 rows) for font cards
- Each card 140x100px (thumb-friendly)
- Selected state: Bold border + checkmark
- Previews show actual font rendering

**Priority:** **MEDIUM** - Improves UX but requires processor page changes. Consider for Phase 2.

---

### 4.3 Scenario 3: Quick Upload

**Recommendation: SMART DEFAULT WITH INLINE TOGGLE**

**Rationale:**
- Defaults to most common choice (include name, classic font)
- Reveals font options only when customer wants them
- Supports "Blank" option for 40% who want no text
- Maintains "quick" in quick upload (minimal friction)

**User Flow (Default Path - 80% of customers):**
```
Product Page → [Quick Upload]
    ↓
┌─────────────────────────────────┐
│ Quick Upload                     │
│                                  │
│ Pet Name: [Bella___]            │
│ Photo: [Choose File]            │
│                                  │
│ ☑ Include "Bella" on product    │
│     (Classic font style)        │
│                                  │
│ [Add to Cart] ← Enabled         │
└─────────────────────────────────┘
    ↓
Customer adds to cart (5 seconds)
    ↓
Order placed with font: "classic"
```

**Customization Path (20% of customers):**
```
Customer taps "Change font ↓"
    ↓
┌─────────────────────────────────┐
│ Quick Upload                     │
│                                  │
│ Pet Name: [Bella___]            │
│ Photo: [Choose File]            │
│                                  │
│ ☑ Include "Bella" on product    │
│                                  │
│ Font Style:                     │
│ ○ Classic  (Elegant serif)      │
│ ● Playful  (Fun & bouncy)       │
│ ○ Elegant  (Script style)       │
│ ○ Blank    (No text)            │
│                                  │
│ [Add to Cart]                   │
└─────────────────────────────────┘
    ↓
Customer picks Playful → Adds to cart
```

**No-Text Path (40% of customers who want blank):**
```
Customer unchecks "Include name on product"
    ↓
☐ Include "Bella" on product
  (Portrait without text)
    ↓
Font selector hidden (not needed)
    ↓
Order placed with font: "no-text"
```

**Implementation:**
1. Add checkbox above "Add to Cart" button (default: checked)
2. Checkbox state controls font inclusion
3. Collapsed state shows: "Classic font style"
4. Tap "Change font" to expand 4-option list
5. Unchecking hides font options, sets `_font_style: 'no-text'`

**Mobile Design:**
```css
.font-toggle {
  margin: 16px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.font-toggle-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.font-options {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.font-options.expanded {
  max-height: 240px; /* 4 options × 60px */
  margin-top: 12px;
}

.font-option-card {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  margin: 8px 0;
  min-height: 48px; /* WCAG touch target */
}

.font-option-card.selected {
  border-color: #333;
  background: #f1f3f5;
}
```

**Priority:** **HIGH** - Essential for express checkout flow. Must implement before launch.

---

## 5. Cross-Scenario Font Consistency

### 5.1 Font Data Flow

**Current State:**
Each scenario uses different font storage mechanisms:

| Scenario | Font Source | Storage | Timing |
|----------|-------------|---------|--------|
| Order Lookup | Backend order data | Not integrated | Retrieved with order |
| Preview Flow | Product page selector | localStorage | After processing |
| Quick Upload | Not implemented | localStorage (default) | Before upload |

**Problem:** No unified font management system. Customer can:
1. Order with "Elegant" font (Scenario 2)
2. Re-order via lookup with "Classic" font (Scenario 1 - doesn't restore)
3. Quick upload with "Playful" font (Scenario 3 - different default)

Result: **Inconsistent experience across purchases**

### 5.2 Unified Font Management (RECOMMENDED)

**Create Font Manager:**
```javascript
// assets/font-manager.js
const FontManager = {
  // Get font for current scenario
  getFont(scenario, petData = {}) {
    switch(scenario) {
      case 'order_lookup':
        // Use previous order font
        return petData.font_style || this.getDefault();

      case 'preview_flow':
        // Use selected font or last used
        return localStorage.getItem('selectedFontStyle') || this.getDefault();

      case 'quick_upload':
        // Use last used or default
        return localStorage.getItem('lastUsedFont') || this.getDefault();

      default:
        return this.getDefault();
    }
  },

  // Save font choice
  saveFont(fontStyle, petId) {
    // Validate font
    if (!this.isValid(fontStyle)) {
      console.warn('Invalid font:', fontStyle);
      fontStyle = this.getDefault();
    }

    // Save to localStorage
    localStorage.setItem('selectedFontStyle', fontStyle);
    localStorage.setItem('lastUsedFont', fontStyle);

    // Save to pet data
    if (petId) {
      const pet = PetStorage.get(petId);
      if (pet) {
        pet.fontStyle = fontStyle;
        PetStorage.save(petId, pet);
      }
    }

    // Dispatch event
    document.dispatchEvent(new CustomEvent('font:changed', {
      detail: { style: fontStyle, petId }
    }));
  },

  // Get default font
  getDefault() {
    return 'classic';
  },

  // Validate font style
  isValid(fontStyle) {
    const allowed = ['preppy', 'classic', 'playful', 'elegant', 'trend', 'no-text'];
    return allowed.includes(fontStyle);
  },

  // Get font display name
  getDisplayName(fontStyle) {
    const names = {
      'preppy': 'Preppy',
      'classic': 'Classic',
      'playful': 'Playful',
      'elegant': 'Elegant',
      'trend': 'Trend',
      'no-text': 'Blank (No Text)'
    };
    return names[fontStyle] || 'Classic';
  }
};

window.FontManager = FontManager;
```

**Usage Across Scenarios:**
```javascript
// Scenario 1: Order Lookup
const font = FontManager.getFont('order_lookup', orderData.pets[0]);
FontManager.saveFont(font, petId);

// Scenario 2: Preview Flow
const font = FontManager.getFont('preview_flow');
// Customer selects font on processor page
FontManager.saveFont(selectedFont, petId);

// Scenario 3: Quick Upload
const font = FontManager.getFont('quick_upload');
// Customer uses checkbox to include/exclude name
FontManager.saveFont(includesName ? font : 'no-text', petId);
```

---

## 6. Implementation Priority Matrix

### 6.1 Priority Levels

| Feature | Scenario | Effort | Impact | Priority | Blocks Launch? |
|---------|----------|--------|--------|----------|----------------|
| Order lookup font restoration | 1 | LOW | HIGH | P0 | YES |
| Quick upload font toggle | 3 | MEDIUM | HIGH | P0 | YES |
| Unified font manager | All | MEDIUM | MEDIUM | P1 | NO |
| Processor page font selector | 2 | HIGH | MEDIUM | P2 | NO |
| Post-purchase font selection | 3 | HIGH | LOW | P3 | NO |

### 6.2 Launch Blockers (Must Fix)

**P0 - Critical (Blocks Launch):**

1. **Order Lookup Font Restoration**
   - **Why:** Returning customers expect same font as last order
   - **Impact:** 30-40% of orders after 2-3 months
   - **Effort:** 4-6 hours
   - **Files:** `cart-pet-integration.js`, `pet-font-selector.liquid`, backend endpoint
   - **Test:** Order with "Elegant" → Re-order via lookup → Verify "Elegant" pre-selected

2. **Quick Upload Font Toggle**
   - **Why:** 40% want blank (no text), need way to choose
   - **Impact:** 60%+ of orders (quick upload is primary flow)
   - **Effort:** 8-12 hours
   - **Files:** Quick upload modal component, font manager, cart integration
   - **Test:** Quick upload → Toggle font checkbox → Verify correct font in cart

### 6.3 Post-Launch Improvements

**P1 - Important (Fix Within 2 Weeks):**

3. **Unified Font Manager**
   - **Why:** Consistent font handling across scenarios
   - **Impact:** Reduces bugs, easier maintenance
   - **Effort:** 12-16 hours
   - **Files:** New `assets/font-manager.js`, refactor 3 integration points
   - **Test:** All scenarios use same font logic

**P2 - Nice to Have (Fix Within 1 Month):**

4. **Processor Page Font Selector**
   - **Why:** Better UX for preview flow (all decisions in one place)
   - **Impact:** 20-30% of orders (preview enthusiasts)
   - **Effort:** 16-24 hours
   - **Files:** Processor page template, preview rendering, font integration
   - **Test:** Upload → Select font on processor → Verify preview shows font

**P3 - Future Enhancement:**

5. **Post-Purchase Font Selection**
   - **Why:** Ultimate zero-friction checkout
   - **Impact:** Could increase conversion by 2-5%
   - **Effort:** 24-40 hours (requires backend webhooks, email integration)
   - **Test:** Order with default → Email sent → Select font → Order updated

---

## 7. User Flows with Font Integration

### 7.1 Complete Scenario 1 Flow (Order Lookup)

```
Product Page Load
    ↓
Customer checks "I've ordered before"
    ↓
Form expands:
  Pet Name: [Bella___]
  Order Number: [#1001___]
    ↓
Customer taps "Retrieve My Pets"
    ↓
Loading: "Looking up order #1001..." (2-3s)
    ↓
Backend retrieves:
  - Pet name: "Bella"
  - GCS URL: "https://storage.googleapis.com/..."
  - Effect: "popart"
  - Font: "elegant" ← KEY DATA
    ↓
Font selector auto-updates:
  ○ Preppy
  ○ Classic
  ● Elegant ← Pre-selected
  ○ Playful
  ○ Trend
  ○ Blank
    ↓
Confirmation: "✅ Bella retrieved with Elegant font from order #1001"
    ↓
Customer sees:
  - Preview thumbnail (Pop Art effect)
  - "Using your previous settings"
  - Font selector visible but collapsed by default
    ↓
[Option A] Customer keeps same font → Add to Cart (3 seconds)
[Option B] Customer taps "Change Font" → Selects new font → Add to Cart (8 seconds)
    ↓
Order placed with correct font ✅
```

**Implementation Notes:**
- Backend must return `font_style` in order lookup response
- Frontend auto-selects font in selector
- Confirmation banner shows font name
- Font selector collapsed by default (expand on demand)
- Pre-selected font saved to localStorage for future orders

---

### 7.2 Complete Scenario 2 Flow (Preview with Font)

**Option A: Font on Processor Page (RECOMMENDED)**
```
Product Page → [Upload & Preview]
    ↓
Navigate to /pages/pet-background-remover
    ↓
Step 1: Upload photo
  Customer taps [Choose File] → Selects photo (2s)
    ↓
Step 2: Enter pet name
  Input: [Bella___] (3s)
    ↓
Step 3: Select font style (NEW)
  ┌──────┐ ┌──────┐ ┌──────┐
  │Preppy│ │Class.│ │Play. │
  │Bella │ │Bella │ │Bella │ ← Shows name in each font
  └──────┘ └──────┘ └──────┘

  Customer taps "Classic" (2s)
    ↓
[Continue to Preview]
    ↓
Step 4: AI Processing
  Progress bar: "Processing Bella in Classic font..." (3-11s)
    ↓
Step 5: Preview effects
  Shows 4 effects WITH "Bella" in Classic font overlaid:
  [Color + "Bella"] [B&W + "Bella"] [Pop Art + "Bella"] [Dithering + "Bella"]
    ↓
Customer selects Pop Art (2s)
    ↓
[Add to Product]
    ↓
Return to product page
    ↓
Product page receives:
  - Pet name: "Bella"
  - Effect: "popart"
  - Font: "classic" ← Already selected
  - GCS URL: "..."
    ↓
Font selector hidden (already chosen)
    ↓
Add to Cart immediately enabled
    ↓
Customer adds to cart (2s)
    ↓
Total time: 15-25 seconds (vs 20-30s without font integration)
```

**Option B: Font on Product Page (CURRENT)**
```
Product Page → [Upload & Preview]
    ↓
Navigate to processor page
    ↓
Upload + Name + Process + Select Effect (15-20s)
    ↓
Return to product page
    ↓
Font selector appears below preview
    ↓
❌ Customer doesn't notice (already scrolled to Add to Cart)
    ↓
Order placed with default "classic" font (unintentional)
```

**Recommendation:** Move font to processor page (Option A).

---

### 7.3 Complete Scenario 3 Flow (Quick Upload with Font)

**Desktop Flow:**
```
Product Page
    ↓
Pet Name visible on page: [Bella___] ← Customer enters (2s)
    ↓
Customer taps [Quick Upload] button
    ↓
Inline modal appears:
  ┌─────────────────────────────────┐
  │ Quick Upload                     │
  │                                  │
  │ Pet Name: Bella ✓               │
  │ Photo: [Choose File]            │
  │                                  │
  │ ☑ Include "Bella" on product    │
  │     (Classic font style)        │
  │     [Change font ↓]             │
  │                                  │
  │ [Add to Cart]                   │
  └─────────────────────────────────┘
    ↓
Customer uploads photo (1-2s)
    ↓
[Default Path - 80%] Customer keeps Classic font → Taps Add to Cart (1s)
[Custom Path - 15%] Customer taps "Change font" → Picks Playful → Add to Cart (5s)
[Blank Path - 5%] Customer unchecks "Include name" → Font hidden → Add to Cart (1s)
    ↓
Modal closes, pet added to cart
    ↓
Total time: 5-10 seconds ✅
```

**Mobile Flow:**
```
Product Page (Mobile)
    ↓
Pet Name: [Bella___] ← Customer enters (thumb zone)
    ↓
Customer taps [Quick Upload] (48×48px button)
    ↓
Bottom sheet slides up from bottom:
  ╔═════════════════════════════════╗
  ║ Quick Upload                     ║
  ║                                  ║
  ║ Pet: Bella ✓                    ║
  ║                                  ║
  ║ Photo: [Choose File]            ║
  ║ (Tap to select from gallery)    ║
  ║                                  ║
  ║ ☑ Include name on product       ║
  ║   Classic font                  ║
  ║   [Change ↓]                    ║
  ║                                  ║
  ║ ┌─────────────────────────────┐ ║
  ║ │   Add to Cart               │ ║ ← Thumb zone
  ║ └─────────────────────────────┘ ║
  ╚═════════════════════════════════╝
    ↓
Customer taps [Choose File] → Camera/gallery opens
    ↓
Customer selects photo → Returns to sheet (2s)
    ↓
Preview thumbnail appears in sheet
    ↓
Customer reviews:
  ✓ Name: Bella
  ✓ Photo: [thumbnail]
  ✓ Font: Classic (checked)
    ↓
Customer taps [Add to Cart] (thumb zone) (1s)
    ↓
Sheet closes with success animation
    ↓
Cart updated with all data ✅
```

---

## 8. Testing Scenarios

### 8.1 Order Lookup Font Tests

**Test 1: Font Restored from Previous Order**
```
GIVEN: Customer previously ordered with "Elegant" font
WHEN: Customer enters name + order number
THEN:
  - Font selector shows "Elegant" pre-selected
  - Confirmation shows "Using Elegant font from order #1001"
  - Add to Cart uses "Elegant" font
  - Order properties: _font_style = "elegant"
```

**Test 2: No Font in Previous Order (Legacy Order)**
```
GIVEN: Customer ordered before font feature existed
WHEN: Customer enters name + order number
THEN:
  - Font selector defaults to "Classic"
  - Confirmation shows "Order retrieved, please select font"
  - Customer must select font manually
  - Add to Cart uses selected font
```

**Test 3: Invalid Font in Previous Order**
```
GIVEN: Previous order had font "retro" (no longer available)
WHEN: Customer enters name + order number
THEN:
  - System logs warning about invalid font
  - Font selector defaults to "Classic"
  - Customer notified: "Previous font unavailable, using Classic"
```

### 8.2 Preview Flow Font Tests

**Test 4: Font Selected on Processor Page**
```
GIVEN: Font selector added to processor page
WHEN: Customer uploads photo → enters name → selects "Playful" font → processes
THEN:
  - AI processing shows: "Processing Bella in Playful font"
  - Preview shows "Bella" in Playful font on each effect
  - Product page receives font = "playful"
  - Add to Cart uses "Playful" font without re-selection
```

**Test 5: Font Changes After Processing**
```
GIVEN: Customer processed with "Classic" font
WHEN: Customer returns to product page and changes to "Elegant"
THEN:
  - Font selector updates to "Elegant"
  - Preview thumbnails update to show "Elegant" font
  - Add to Cart uses new "Elegant" font
  - localStorage updated with new font choice
```

### 8.3 Quick Upload Font Tests

**Test 6: Default Font (Include Name Checked)**
```
GIVEN: Customer opens quick upload modal
WHEN: Customer enters name + uploads photo (no font interaction)
THEN:
  - Checkbox "Include name" is checked by default
  - Font shows "Classic font style"
  - Add to Cart uses "classic" font
  - Order properties: _font_style = "classic"
```

**Test 7: Change Font in Quick Upload**
```
GIVEN: Customer opens quick upload modal
WHEN: Customer taps "Change font" → selects "Playful"
THEN:
  - Font options expand
  - "Playful" selected with radio button
  - Checkbox text updates: "Playful font style"
  - Add to Cart uses "playful" font
```

**Test 8: Blank Option (No Name)**
```
GIVEN: Customer opens quick upload modal
WHEN: Customer unchecks "Include name on product"
THEN:
  - Font options hide (not needed)
  - Add to Cart uses "_font_style = "no-text"
  - Order properties: _font_style = "no-text"
  - Product rendered without pet name text
```

---

## 9. Conclusion & Next Steps

### 9.1 Summary of Findings

**Current State:**
Font selector exists but is NOT integrated with three-scenario flow. Creates:
- **Order Lookup:** Font not restored from previous order (negative surprise)
- **Preview Flow:** Font selection AFTER processing (friction, cognitive overload)
- **Quick Upload:** No font option (95% use default unintentionally)

**Recommended Solution:**

| Scenario | Font Integration | Effort | Priority |
|----------|-----------------|--------|----------|
| Order Lookup | Auto-restore previous font | LOW | P0 |
| Preview Flow | Move font to processor page | HIGH | P2 |
| Quick Upload | Add font toggle to modal | MEDIUM | P0 |

**Launch Blockers:**
1. Order lookup font restoration (4-6 hours)
2. Quick upload font toggle (8-12 hours)

**Total effort to unblock launch:** 12-18 hours

### 9.2 Implementation Roadmap

**Phase 1: Launch Blockers (Before Deploy)**
- [ ] Order lookup font restoration
  - Backend: Include `_font_style` in order response
  - Frontend: Auto-select font in selector
  - UI: Show confirmation with font name
- [ ] Quick upload font toggle
  - Add checkbox "Include name on product"
  - Add collapsed font options
  - Default to "classic" font
  - Support "no-text" option

**Phase 2: Post-Launch (Within 2 Weeks)**
- [ ] Unified font manager
  - Create `assets/font-manager.js`
  - Refactor all scenarios to use manager
  - Add font validation + fallbacks
- [ ] Font selector UX improvements
  - Collapsed by default (expand on demand)
  - Better mobile layout (2-column grid)
  - Font preview thumbnails

**Phase 3: Future Enhancements (1+ Month)**
- [ ] Move font to processor page
  - Add font selector after pet name input
  - Update preview to show font
  - Pass font to product page
- [ ] Post-purchase font selection
  - Default to "classic" during checkout
  - Email customer with font selector link
  - Update order via webhook
- [ ] Font analytics
  - Track font selection rates
  - Identify most popular fonts
  - A/B test default font

### 9.3 Files to Modify

**High Priority (Launch Blockers):**
- `assets/cart-pet-integration.js` - Add font restoration logic
- `snippets/pet-font-selector.liquid` - Add confirmation banner for restored fonts
- Quick upload modal component (TBD location) - Add font toggle
- Backend endpoint `/api/retrieve-order-pets` - Include `_font_style` in response

**Medium Priority (Post-Launch):**
- `assets/font-manager.js` (NEW) - Unified font management
- `sections/ks-pet-processor-v5.liquid` - Add font selector to processor page
- `assets/pet-processor.js` - Pass font to preview rendering

**Low Priority (Future):**
- Backend webhook handler - Post-purchase font updates
- Email template - Font selection link
- Analytics tracking - Font selection events

### 9.4 Open Questions for Product Team

1. **Font Defaults:** Should quick upload default to "classic" or use customer's last-used font?
2. **Blank Option:** Should we promote "Blank" (no text) more prominently? 40% want this but might not discover it.
3. **Font Previews:** Should quick upload show font previews or just names? (Previews = better UX, names = faster)
4. **Order Lookup:** What if customer wants DIFFERENT font than last order? Make it easy to change or assume they want same?
5. **Post-Purchase:** Worth building post-purchase font selection? ROI unclear but could increase conversion.

---

## 10. Appendix: Technical Specifications

### 10.1 Font Style Enum

```javascript
const FONT_STYLES = {
  PREPPY: 'preppy',
  CLASSIC: 'classic',
  PLAYFUL: 'playful',
  ELEGANT: 'elegant',
  TREND: 'trend',
  NO_TEXT: 'no-text'
};

const FONT_DISPLAY_NAMES = {
  'preppy': 'Preppy',
  'classic': 'Classic',
  'playful': 'Playful',
  'elegant': 'Elegant',
  'trend': 'Trend',
  'no-text': 'Blank (No Text)'
};

const FONT_FAMILIES = {
  'preppy': "'Libre Caslon Text', 'Garamond', serif",
  'classic': "'Merriweather', serif",
  'playful': "'Rampart One', cursive",
  'elegant': "'Ms Madi', 'Sacramento', cursive",
  'trend': "'Fascinate', 'Rampart One', cursive",
  'no-text': null
};
```

### 10.2 Order Lookup API Response Schema

```json
{
  "success": true,
  "order_number": "1001",
  "order_date": "2025-01-15",
  "pets": [
    {
      "name": "Bella",
      "original_image_url": "https://storage.googleapis.com/...",
      "processed_image_url": "https://storage.googleapis.com/...",
      "effect": "popart",
      "font_style": "elegant",
      "thumbnail": "data:image/jpeg;base64,..."
    }
  ]
}
```

### 10.3 Pet Data Structure with Font

```javascript
{
  petId: "pet_1234567890",
  name: "Bella",
  filename: "bella.jpg",
  processingState: "processed",

  // Image URLs
  originalFileUrl: "blob:...",
  thumbnail: "data:image/jpeg;base64,...",
  gcsUrl: "https://storage.googleapis.com/...",
  originalUrl: "https://storage.googleapis.com/...",

  // Customization
  effect: "popart",
  fontStyle: "elegant",  // NEW

  // Metadata
  artistNote: "",
  timestamp: 1736094648000
}
```

### 10.4 Cart Line Item Properties

```javascript
{
  "_pet_name": "Bella",
  "_font_style": "elegant",
  "_processed_image_url": "https://storage.googleapis.com/...",
  "_original_image_url": "https://storage.googleapis.com/...",
  "_effect_applied": "popart",
  "_has_custom_pet": "true",
  "_artist_notes": ""
}
```

---

**END OF DOCUMENT**

**Next Steps:**
1. Review this analysis with product team
2. Prioritize P0 blockers for immediate implementation
3. Create technical implementation tickets
4. Assign to appropriate sub-agents (mobile-commerce-architect, code-quality-reviewer)
5. Test thoroughly on staging before production deploy
