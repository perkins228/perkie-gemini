# Three-Scenario Pet Checkout UX Design Specification

**Agent**: ux-design-ecommerce-expert
**Date**: 2025-10-20
**Last Updated**: 2025-10-20 (Scenario 1 Redesign)
**Status**: Implementation-Ready Design Specification
**Related Docs**: `.claude/doc/add-to-cart-blocker-ux-analysis.md`

---

## UPDATE: Scenario 1 Redesigned (Order Lookup Approach)

**What Changed**: Scenario 1 (Returning Customer) has been **completely redesigned** from localStorage-based pet selection to **order number lookup**.

**Previous Approach** (DEPRECATED):
- Relied on localStorage to save pet data
- Multi-select UI with saved pet thumbnails
- One-click selection from browser storage
- **Problem**: 60+ days is too long for localStorage reliability

**New Approach** (CURRENT):
- Customer enters pet name(s) + previous order number
- Backend retrieves pet data from Shopify order line item properties
- Extracts GCS URLs, effect, font, etc. from order
- Displays retrieved pets with thumbnails
- **Advantages**:
  - No localStorage expiry issues (60+ days no problem)
  - Works across devices (order number portable)
  - More reliable than browser storage
  - Customer already has order number in email
  - Supports multi-pet orders (comma-separated names)

**Technical Requirements**:
1. **Backend Endpoint**: `/api/retrieve-order-pets` (POST)
2. **Input**: Pet names (comma-separated) + Order number
3. **Validation**: Order exists, contains pet data, names match
4. **Response**: Pet names, GCS URLs, effects, fonts, thumbnails
5. **Error Handling**: Order not found, no pet data, name mismatch

**Time to Purchase**: 5-10 seconds (same as before, slightly longer due to 2-3s lookup)

**UX Improvements**:
- Simpler for customers (just 2 fields vs complex multi-select)
- Clear fallback to Scenario 3 (Quick Upload) if lookup fails
- Better error messaging and recovery paths
- Cross-device support (iPhone → iPad seamless)

---

## Executive Summary

This specification defines a unified UX/UI solution that gracefully handles three distinct customer scenarios while maintaining pet name capture as a universal requirement. The design prioritizes mobile-first experience (70% traffic), conversion optimization, and eliminates the forced 3-11s AI processing delay as a purchase blocker.

**Key Design Principle**: Make AI preview optional, not mandatory, while capturing pet name in all scenarios.

---

## Design Goals

1. **Universal Pet Name Capture**: Ensure pet name is collected in all three scenarios
2. **Optional AI Processing**: Enable purchase without waiting for 3-11s preview
3. **Mobile-First**: Optimize for 70% mobile traffic with thumb-zone patterns
4. **Zero Friction Checkout**: Remove forced upload as conversion blocker
5. **Trust & Clarity**: Clear messaging about what customer gets in each scenario
6. **Accessibility**: WCAG 2.1 AA compliant throughout

---

## Three Customer Scenarios - User Flows

### Scenario 1: Returning Customer (Order Lookup)

**User Goal**: "I ordered before - use my previous pet photo again"

**User Flow**:
```
Product Page Load
    ↓
Pet Selector displays "Ordering Again?" section
    ↓
Customer enters pet name(s): "Bella, Milo"
    ↓
Customer enters previous order number: "#1001"
    ↓
Customer taps "Retrieve My Pets" button
    ↓
Loading state: "Looking up your order..." (2-3s)
    ↓
Backend validates order and retrieves pet data from Shopify
    ↓
SUCCESS: Pet images and data populate hidden form fields
    ↓
✅ Confirmation: "Bella & Milo retrieved from order #1001!"
    ↓
Preview thumbnails show retrieved pet images
    ↓
Add to Cart button enabled (no re-processing needed)
    ↓
Customer adds to cart → Checkout
```

**Time to Purchase**: 5-10 seconds
**Processing Required**: None (uses existing GCS URLs from order properties)
**Pet Name Source**: Customer input, validated against order data
**Reliability**: Works across devices, no localStorage expiry issues

**UX Requirements**:
- Simple two-field form (pet name + order number)
- Clear instructions for finding order number
- Loading state with friendly messaging
- Error handling for invalid orders
- Preview of retrieved pets before cart
- Fallback to Scenario 3 (Quick Upload) if order lookup fails

---

### Scenario 2: New Customer with Preview

**User Goal**: "I want to see how my pet will look with different effects"

**User Flow**:
```
Product Page Load
    ↓
Pet Selector shows "Upload Optional" state
    ↓
Customer taps "Upload & Preview" button
    ↓
Navigate to /pages/pet-background-remover
    ↓
Upload photo → Enter pet name → AI processing (3-11s)
    ↓
Preview 4 effects → Select preferred effect
    ↓
"Add to Product" button
    ↓
Return to product page
    ↓
Add to Cart enabled → Checkout
```

**Time to Purchase**: 15-30 seconds
**Processing Required**: Full AI processing (3-11s)
**Pet Name Source**: Captured during upload flow

**UX Requirements**:
- Clear value proposition: "See your pet in 4 styles"
- Progress indication during 3-11s wait
- Effect preview with visual examples
- "Skip Preview" option during processing
- Pet name input field on upload page

---

### Scenario 3: Express Buyer (Skip Preview) - PRIMARY FOCUS

**User Goal**: "I trust your AI, just use my photo - I want to checkout NOW"

**User Flow - Option A: Upload Without Preview**:
```
Product Page Load
    ↓
Pet Selector shows "Upload Optional" state
    ↓
Customer taps "Quick Upload" button
    ↓
Inline pet name + image upload modal (no navigation)
    ↓
Enter pet name: [          ] (required)
Upload photo: [Choose File] (required)
    ↓
Upload completes (~1s) → "We'll process in background"
    ↓
Add to Cart enabled immediately → Checkout
    ↓
Email preview sent when AI processing completes
```

**Time to Purchase**: 10 seconds
**Processing Required**: Async (happens after purchase)
**Pet Name Source**: Inline input field

**User Flow - Option B: No Upload (Trust Default)**:
```
Product Page Load
    ↓
Pet Selector shows "Upload Optional" state
    ↓
Customer enters pet name: [          ] (required)
    ↓
Customer taps "I'll upload later" or leaves pet image empty
    ↓
Add to Cart enabled (with pet name only)
    ↓
Checkout completes
    ↓
Order confirmation email: "Upload your pet photo within 24h"
    ↓
Customer uploads via unique link in email
```

**Time to Purchase**: 5 seconds
**Processing Required**: None (post-purchase upload)
**Pet Name Source**: Inline input field on product page

**UX Requirements**:
- No forced navigation away from product
- Inline modal for quick upload
- Clear messaging: "Upload now or later"
- Pet name field ALWAYS visible and required
- Upload field optional with "I'll send later" option
- Trust signals: "We'll email you for approval before shipping"
- Mobile-optimized form with proper input types
- Progress indication for upload only (~1s)
- Email upload link with 24h deadline

---

## Core UI Components

### Component 1: Unified Pet Selector (Product Page)

**Purpose**: Handle all three scenarios from one interface

**Visual Layout** (Mobile-First):

```
┌─────────────────────────────────────────────────────┐
│ 🐾 Your Pet                                         │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet Name (Required)                             ││
│ │ [                                    ]          ││
│ │ We'll personalize your product with this name   ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet Photo (Optional)                            ││
│ │                                                  ││
│ │ ▼ Choose what works best for you:               ││
│ │                                                  ││
│ │ Option 1: Ordering Again?                        ││
│ │ ┌─────────────────────────────────────────────┐││
│ │ │ 🎉 Returning Customer?                      │││
│ │ │                                              │││
│ │ │ Pet Name(s)                                 │││
│ │ │ [Bella, Milo               ]                │││
│ │ │ (same as previous order)                    │││
│ │ │                                              │││
│ │ │ Previous Order Number                       │││
│ │ │ [#1001                     ]                │││
│ │ │ Find on order confirmation email            │││
│ │ │                                              │││
│ │ │ [Retrieve My Pets]                          │││
│ │ │                                              │││
│ │ │ ℹ️ We'll use your previous pet photos      │││
│ │ └─────────────────────────────────────────────┘││
│ │                                                  ││
│ │ Option 2: Upload New Photo                      ││
│ │ [📸 Quick Upload] [🎨 Upload & Preview]        ││
│ │                                                  ││
│ │ Option 3: Skip Upload                           ││
│ │ [📧 I'll send my photo later]                   ││
│ │                                                  ││
│ │ ℹ️ No rush! You can upload after checkout       ││
│ │    We'll email you a link                       ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ [ Add to Cart ] ← ALWAYS ENABLED when name entered │
└─────────────────────────────────────────────────────┘
```

**Interaction States**:

1. **Empty State** (No input):
   - Pet name field: Empty (cursor focus)
   - Upload options: All visible
   - Order lookup: Collapsed or hidden by default
   - Add to Cart: Disabled with message "Enter pet name above"

2. **Name Only State** (Name entered, no photo):
   - Pet name field: Filled
   - Upload options: All visible
   - Add to Cart: Enabled
   - Helper text: "Add photo now or later"

3. **Order Lookup Loading**:
   - Retrieve button: Disabled with spinner
   - Status text: "Looking up order #1001..."
   - Form fields: Disabled during lookup
   - Add to Cart: Disabled
   - Loading duration: 2-3 seconds

4. **Order Lookup Success**:
   - Pet name field: Auto-filled from order data
   - Preview thumbnails: Show retrieved pet images
   - Form fields: Hidden or collapsed
   - Add to Cart: Enabled
   - Confirmation: "✅ Bella & Milo retrieved from order #1001!"
   - Helper text: "Using your previous pet photos"

5. **Order Lookup Error**:
   - Error message: "Order not found" or "No pet data in order"
   - Fallback CTA: "Upload new photo instead"
   - Form fields: Re-enabled for retry
   - Add to Cart: Disabled
   - Alternative path: Shows Quick Upload option

6. **New Photo Uploaded**:
   - Pet name field: Filled
   - Upload status: "Photo uploaded! Processing..."
   - Add to Cart: Enabled
   - Helper text: "We'll email your preview shortly"

**Mobile Optimizations**:
- Pet name input: `type="text"` with `autocapitalize="words"`
- Minimum 44x44px tap targets for all buttons
- Saved pet cards: 80x80px with 12px gaps
- Thumb-zone: Primary actions bottom 1/3 of screen
- Bottom sheet for quick upload modal
- Auto-scroll to pet name field on page load

---

### Component 2: Order Lookup Form (Returning Customer)

**Purpose**: Enable returning customers to retrieve previous pet photos via order number

**Visual Layout** (Mobile Bottom Sheet or Inline Expansion):

```
┌─────────────────────────────────────────────────────┐
│ 🎉 Ordering Again?                                   │
│                                                      │
│ Pet Name(s) *                                        │
│ [Bella, Milo                    ]                    │
│ Enter same name(s) as previous order                 │
│                                                      │
│ Previous Order Number *                              │
│ [#1001                          ]                    │
│ Find this in your order confirmation email           │
│                                                      │
│ [Retrieve My Pets]  ← Primary CTA                    │
│                                                      │
│ ℹ️ We'll automatically use your previous pet photos │
│    No need to re-upload!                             │
│                                                      │
│ [Cancel]                                             │
└─────────────────────────────────────────────────────┘
```

**Loading State**:
```
┌─────────────────────────────────────────────────────┐
│ 🎉 Ordering Again?                                   │
│                                                      │
│ Pet Name(s): Bella, Milo                             │
│ Order Number: #1001                                  │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🔍 Looking up your order...                     │ │
│ │ [==========>          ] 70%                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ This usually takes 2-3 seconds                       │
└─────────────────────────────────────────────────────┘
```

**Success State**:
```
┌─────────────────────────────────────────────────────┐
│ ✅ Pets Retrieved!                                   │
│                                                      │
│ Order #1001 - Purchased Jan 15, 2025                 │
│                                                      │
│ ┌────────┐ ┌────────┐                               │
│ │[thumb] │ │[thumb] │                               │
│ │  Bella │ │  Milo  │                               │
│ │Original│ │Pop Art │                               │
│ └────────┘ └────────┘                               │
│                                                      │
│ ✅ Using your previous pet photos                    │
│ Same high-quality images as your last order          │
│                                                      │
│ [Continue to Cart]                                   │
│                                                      │
│ Wrong pets? [Upload Different Photos]                │
└─────────────────────────────────────────────────────┘
```

**Error States**:

**Error 1: Order Not Found**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Order Not Found                                   │
│                                                      │
│ We couldn't find order #1001 in our system.         │
│                                                      │
│ Please check:                                        │
│ • Order number is correct (include the #)           │
│ • Order was placed on perkieprints.com              │
│ • Email matches your account                        │
│                                                      │
│ [Try Again] [Upload New Photo Instead]              │
└─────────────────────────────────────────────────────┘
```

**Error 2: No Pet Data in Order**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ No Pet Photos Found                               │
│                                                      │
│ Order #1001 exists, but doesn't contain pet photos. │
│                                                      │
│ This might happen if:                                │
│ • Order was for a non-pet product                   │
│ • Order was placed before our AI feature launched   │
│                                                      │
│ No problem! Upload your pet photo now:               │
│                                                      │
│ [📸 Quick Upload] [🎨 Upload & Preview]            │
└─────────────────────────────────────────────────────┘
```

**Error 3: Pet Names Don't Match**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Pet Names Don't Match                             │
│                                                      │
│ Order #1001 has pets named: "Max, Charlie"           │
│ You entered: "Bella, Milo"                           │
│                                                      │
│ Did you mean to use:                                 │
│ [Use Max & Charlie] [Try Different Order]           │
│                                                      │
│ Or upload new pets:                                  │
│ [Upload Bella & Milo Instead]                        │
└─────────────────────────────────────────────────────┘
```

**Specifications**:

1. **Field Requirements**:
   - Pet Name(s): Text input, supports comma-separated names
   - Order Number: Text input, accepts "#1001" or "1001" format
   - Both fields required for lookup
   - Real-time validation before submit

2. **Order Number Format**:
   - Accept with or without "#" prefix
   - Strip whitespace automatically
   - Example inputs: "#1001", "1001", " #1001 " (all valid)
   - Shopify order format: 4-5 digits typically

3. **Backend Integration**:
   ```javascript
   async function retrievePetsFromOrder(petNames, orderNumber) {
     // Call Shopify API or custom endpoint
     const response = await fetch('/api/retrieve-order-pets', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         pet_names: petNames,
         order_number: orderNumber.replace('#', '').trim()
       })
     });

     if (!response.ok) {
       throw new Error(await response.text());
     }

     return await response.json();
   }
   ```

4. **Response Data Structure**:
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
         "effect": "original",
         "font_style": "classic",
         "thumbnail": "data:image/jpeg;base64,..."
       },
       {
         "name": "Milo",
         "original_image_url": "https://storage.googleapis.com/...",
         "processed_image_url": "https://storage.googleapis.com/...",
         "effect": "popart",
         "font_style": "modern",
         "thumbnail": "data:image/jpeg;base64,..."
       }
     ]
   }
   ```

5. **Validation Logic**:
   ```javascript
   function validateOrderLookup(petNamesInput, orderNumberInput) {
     const errors = [];

     // Pet names validation
     const petNames = petNamesInput.split(',').map(n => n.trim()).filter(n => n);
     if (petNames.length === 0) {
       errors.push('Please enter at least one pet name');
     }

     // Order number validation
     const orderNum = orderNumberInput.replace('#', '').trim();
     if (!orderNum || orderNum.length === 0) {
       errors.push('Please enter your order number');
     }
     if (!/^\d{4,5}$/.test(orderNum)) {
       errors.push('Order number should be 4-5 digits (e.g., 1001)');
     }

     return { valid: errors.length === 0, errors, petNames, orderNum };
   }
   ```

6. **Multi-Pet Support**:
   - Comma-separated input: "Bella, Milo, Max"
   - Validates each name against order data
   - Retrieves all matching pets from order
   - Displays all thumbnails in success state
   - Populates form with all pet data

7. **Security & Privacy**:
   - Optional: Verify customer email matches order
   - Rate limiting: Max 5 lookup attempts per minute
   - No PII displayed except pet names
   - Order number alone insufficient for data access (email verification recommended)

8. **Mobile Optimizations**:
   - Bottom sheet pattern (native mobile UX)
   - Auto-focus on pet name field
   - Keyboard-friendly number input for order field
   - Large tap targets (44x44px minimum)
   - Swipe-down to dismiss

9. **Accessibility**:
   ```html
   <form aria-label="Order lookup form">
     <label for="order-pet-names">
       Pet Name(s) <span aria-label="required">*</span>
     </label>
     <input
       type="text"
       id="order-pet-names"
       name="pet_names"
       placeholder="e.g., Bella, Milo"
       required
       aria-describedby="pet-names-help"
       aria-invalid="false">
     <span id="pet-names-help" class="help-text">
       Enter same name(s) as your previous order
     </span>

     <label for="order-number">
       Previous Order Number <span aria-label="required">*</span>
     </label>
     <input
       type="text"
       id="order-number"
       name="order_number"
       placeholder="e.g., #1001"
       required
       pattern="\d{4,5}"
       aria-describedby="order-number-help"
       aria-invalid="false">
     <span id="order-number-help" class="help-text">
       Find this in your order confirmation email
     </span>

     <button
       type="submit"
       aria-label="Retrieve pets from previous order">
       Retrieve My Pets
     </button>

     <div role="status" aria-live="polite" aria-atomic="true">
       <!-- Loading/success/error messages appear here -->
     </div>
   </form>
   ```

10. **Performance**:
    - Lookup timeout: 10 seconds maximum
    - Debounce input validation: 300ms
    - Cache retrieved pet data in sessionStorage
    - Prefetch thumbnails during loading state

---

### Component 3: Quick Upload Modal (Bottom Sheet)

**Purpose**: Enable express upload without leaving product page

**Visual Layout** (Mobile):

```
┌─────────────────────────────────────────────────────┐
│                         ─                            │ ← Drag handle
│                                                      │
│ 🚀 Quick Upload                                      │
│                                                      │
│ Pet Name                                             │
│ [Bella                          ] ← Pre-filled      │
│                                                      │
│ Upload Photo                                         │
│ [                                    ]               │
│ [ 📸 Camera ] [ 📁 Gallery ]                        │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ⚡ Express Mode                                  │ │
│ │ We'll process your photo in the background      │ │
│ │ and email you a preview within minutes          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [ Upload & Continue Shopping ]  ← Primary CTA       │
│                                                      │
│ [Cancel]                                             │
└─────────────────────────────────────────────────────┘
```

**Behavior**:
- Slides up from bottom (native mobile pattern)
- Pet name pre-filled from main input
- Camera/Gallery native pickers
- Upload happens (~1s)
- Success: "✅ Photo uploaded! Processing in background"
- Auto-dismiss after 2s
- Returns to product page
- Add to Cart enabled

**Error Handling**:
- Upload fails → "No problem! You can send via email later"
- Network timeout → "Upload saved, will retry automatically"
- File too large → "Photo too large. Try a smaller image"
- Always provide escape hatch: "Continue without photo"

---

### Component 3: Pet Name Input Field

**Purpose**: Capture pet name in ALL scenarios as universal requirement

**Visual Layout**:

```
┌─────────────────────────────────────────────────────┐
│ Pet Name *                                           │
│ [                                              ]     │
│ Required for personalization                         │
└─────────────────────────────────────────────────────┘
```

**Specifications**:
- Label: "Pet Name" with asterisk (required)
- Input type: `text`
- Placeholder: "e.g., Bella"
- Max length: 50 characters
- Validation: Required, no special characters except hyphen/apostrophe
- Help text: "Required for personalization"
- Error state: "Pet name is required to continue"

**Auto-fill Behavior**:
- Scenario 1 (Saved pet): Auto-fills when pet selected
- Scenario 2 (Preview upload): Captured on upload page, pre-fills here
- Scenario 3 (Quick upload): User enters directly

**Validation Rules**:
```javascript
function validatePetName(name) {
  // Must not be empty
  if (!name || name.trim() === '') {
    return 'Pet name is required';
  }

  // Length check (1-50 chars)
  if (name.length > 50) {
    return 'Pet name must be 50 characters or less';
  }

  // Allow letters, spaces, hyphens, apostrophes only
  if (!/^[A-Za-z\s\-']+$/.test(name)) {
    return 'Pet name can only contain letters, spaces, hyphens, and apostrophes';
  }

  return null; // Valid
}
```

**Accessibility**:
```html
<label for="pet-name">
  Pet Name <span aria-label="required">*</span>
</label>
<input
  type="text"
  id="pet-name"
  name="properties[_pet_name]"
  required
  maxlength="50"
  aria-describedby="pet-name-help"
  aria-invalid="false">
<span id="pet-name-help" class="help-text">
  Required for personalization
</span>
<span id="pet-name-error" class="error-text" role="alert" style="display:none;">
  <!-- Error messages appear here -->
</span>
```

---

### Component 4: Upload Choice Buttons

**Purpose**: Present three upload options with clear value props

**Visual Layout** (Mobile-First):

```
┌─────────────────────────────────────────────────────┐
│ Pet Photo (Optional)                                 │
│                                                      │
│ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ 🚀 Quick Upload      │ │ 🎨 Upload & Preview  │  │
│ │ Upload now,          │ │ See your pet in      │  │
│ │ process later        │ │ 4 styles (3-11s)     │  │
│ │                      │ │                      │  │
│ │ [Upload]             │ │ [Preview]            │  │
│ └──────────────────────┘ └──────────────────────┘  │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📧 I'll send my photo later                     │ │
│ │ We'll email you a secure upload link            │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Button Specifications**:

1. **Quick Upload Button**:
   - Label: "🚀 Quick Upload"
   - Subtitle: "Upload now, process later"
   - Action: Opens quick upload modal
   - Time: ~1s upload
   - Mobile size: 44px height minimum

2. **Upload & Preview Button**:
   - Label: "🎨 Upload & Preview"
   - Subtitle: "See your pet in 4 styles (3-11s)"
   - Action: Navigate to /pages/pet-background-remover
   - Time: 15-30s full flow
   - Mobile size: 44px height minimum

3. **Send Later Button**:
   - Label: "📧 I'll send my photo later"
   - Subtitle: "We'll email you a secure upload link"
   - Action: Sets flag for post-purchase upload
   - Time: Instant
   - Mobile size: 44px height minimum
   - Style: Secondary (outlined, not filled)

**Visual Hierarchy**:
- Quick Upload: Primary color (blue)
- Upload & Preview: Secondary color (purple)
- Send Later: Tertiary (outlined)

**Thumb-Zone Optimization**:
- Stack vertically on mobile (<750px)
- Place most common choice (Quick Upload) in middle
- 12px gaps between buttons
- Full-width on mobile for easy tapping

---

### Component 5: Add to Cart Button Logic

**Purpose**: Enable cart button based on pet name, not photo upload

**State Machine**:

```javascript
// Button enabled when:
const isEnabled = () => {
  const petName = getPetNameInput();
  return petName && petName.trim().length > 0;
};

// Three states:
// 1. Disabled: No pet name entered
// 2. Enabled (Name Only): Pet name entered, no photo
// 3. Enabled (Full): Pet name + photo selected/uploaded
```

**Visual States**:

1. **Disabled State** (No pet name):
```
┌─────────────────────────────────────────────────────┐
│ [ Add to Cart ]                                      │
│ ↑ Enter pet name above                               │
│                                                      │
│ Style: opacity 0.6, cursor not-allowed               │
└─────────────────────────────────────────────────────┘
```

2. **Enabled (Name Only)** (Pet name entered, no photo):
```
┌─────────────────────────────────────────────────────┐
│ [ Add to Cart ]                                      │
│ ✅ You can upload photo after checkout               │
│                                                      │
│ Style: Full opacity, cursor pointer                  │
└─────────────────────────────────────────────────────┘
```

3. **Enabled (Full)** (Pet name + photo):
```
┌─────────────────────────────────────────────────────┐
│ [ Add to Cart ]                                      │
│ ✅ Bella selected - Ready to order!                  │
│                                                      │
│ Style: Full opacity, cursor pointer, pulse animation │
└─────────────────────────────────────────────────────┘
```

**Accessibility**:
```html
<!-- Disabled State -->
<button
  type="submit"
  name="add"
  disabled
  aria-disabled="true"
  aria-describedby="add-to-cart-help">
  Add to Cart
</button>
<span id="add-to-cart-help" class="help-text">
  Enter pet name above to continue
</span>

<!-- Enabled State -->
<button
  type="submit"
  name="add"
  aria-describedby="add-to-cart-status">
  Add to Cart
</button>
<span id="add-to-cart-status" class="status-text">
  You can upload photo after checkout
</span>
```

**Mobile Behavior**:
- Fixed position at bottom on mobile
- Always visible (no need to scroll)
- 56px height for easy tapping
- Full-width for thumb-zone optimization

---

## Trust Signals & Messaging

### Key Messages by Scenario

**Scenario 1 (Saved Pet)**:
- "✅ Bella selected - Ready to order!"
- "Your photo is already processed"
- "One-click checkout"

**Scenario 2 (Preview Upload)**:
- "See your pet in 4 professional styles"
- "Takes 3-11 seconds to process"
- "Choose your favorite before checkout"

**Scenario 3 (Express)**:
- "Upload now, process later - No waiting!"
- "We'll email you a preview for approval"
- "Your order won't ship until you approve"
- "Upload via email link within 24 hours"

### Trust-Building Elements

1. **Processing Time Transparency**:
   - "3-11 seconds" not "just a moment"
   - "Email preview in 5 minutes" not "soon"
   - Real progress bars, not fake spinners

2. **Approval Safety Net**:
   - "We'll send preview before shipping"
   - "Free changes within 24 hours"
   - "100% satisfaction guarantee"

3. **Flexibility Messaging**:
   - "Upload optional - Order anytime"
   - "Change your mind? Upload later!"
   - "No rush - 24 hour upload window"

4. **Visual Trust Signals**:
   - Lock icon: "Secure photo upload"
   - Shield icon: "Privacy protected"
   - Clock icon: "24-hour upload deadline"
   - Checkmark icon: "Processing complete"

5. **Social Proof**:
   - "Join 10,000+ happy pet parents"
   - "4.9★ rated AI background removal"
   - Customer photo examples

---

## Mobile-First Interaction Patterns

### Gesture Support

1. **Swipe to Select Pet**:
   - Horizontal swipe through saved pet cards
   - Similar to Instagram Stories pattern
   - Haptic feedback on selection

2. **Pull to Upload**:
   - Pull down on pet selector to reveal upload options
   - Progressive disclosure pattern

3. **Tap to Expand**:
   - Tap upload options to see more details
   - Accordion pattern for additional info

### Bottom Sheet for All Modals

**Why Bottom Sheet**:
- Native mobile pattern (iOS/Android)
- Thumb-zone optimized (controls at bottom)
- Non-blocking (can see product behind)
- Easy to dismiss (swipe down)

**Use Cases**:
- Quick upload modal
- Pet name edit modal
- Upload option picker
- Error messages with actions

### Progressive Disclosure

**Principle**: Show most common path first, hide complexity

**Application**:
1. Default view: Pet name + Quick upload button
2. Tap "More options" → Shows saved pets + preview upload
3. Tap "Help" → Shows detailed explanation

**Mobile Layout**:
```
Default (Collapsed):
┌────────────────────────┐
│ Pet Name: [        ]   │
│ [Quick Upload]         │
│ › More upload options  │
└────────────────────────┘

Expanded:
┌────────────────────────┐
│ Pet Name: [        ]   │
│ [Quick Upload]         │
│ [Upload & Preview]     │
│ [Send Later]           │
│ ▲ Less options         │
└────────────────────────┘
```

---

## Error Prevention & Recovery

### Error Scenarios & Solutions

#### Error 1: Upload Timeout

**Scenario**: Network drops during upload

**Prevention**:
- Chunked upload with resume capability
- Progress saved in localStorage
- Automatic retry on reconnection

**Recovery UX**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Upload Interrupted                                │
│                                                      │
│ Don't worry - your progress is saved!                │
│                                                      │
│ [ Resume Upload ] [ Continue Without Photo ]        │
└─────────────────────────────────────────────────────┘
```

#### Error 2: Processing Failure

**Scenario**: AI processing fails after upload

**Prevention**:
- Validate image before processing
- Check file size/format upfront
- Fallback to original image

**Recovery UX**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Processing Delayed                                │
│                                                      │
│ Your photo is uploaded successfully!                 │
│ We're experiencing high demand - your preview        │
│ will be emailed within the hour.                     │
│                                                      │
│ [ Continue Shopping ] [ View Upload Status ]        │
└─────────────────────────────────────────────────────┘
```

#### Error 3: Pet Name Missing at Checkout

**Scenario**: User bypasses validation, reaches checkout without name

**Prevention**:
- Client-side validation before add to cart
- Server-side validation on cart add
- Disable button until name entered

**Recovery UX**:
```
┌─────────────────────────────────────────────────────┐
│ 🐾 Almost There!                                     │
│                                                      │
│ We need your pet's name to personalize this order   │
│                                                      │
│ Pet Name: [                    ]                     │
│                                                      │
│ [ Save & Continue to Checkout ]                     │
└─────────────────────────────────────────────────────┘
```

#### Error 4: Customer Never Uploads (Post-Purchase)

**Scenario**: Order placed with "send later" - no upload after 24h

**Prevention**:
- Clear messaging: "24-hour upload deadline"
- Email reminders at 1h, 12h, 24h
- SMS reminder at 23h (if phone provided)

**Recovery UX** (Email):
```
Subject: ⏰ Upload Deadline: 2 Hours Left

Hi there!

We're excited to create your custom pet product, but we haven't
received your pet's photo yet.

[Upload Photo Now] ← Big button

Upload deadline: Today at 11:59 PM
Order #12345

Need help? Reply to this email or call us at (555) 123-4567

Still don't have a photo? We can:
• Extend your deadline (just ask!)
• Refund your order (no questions asked)
• Ship with a placeholder (send photo for replacement)
```

### Validation Rules Summary

| Field | Required | Validation | Error Message |
|-------|----------|------------|---------------|
| Pet Name | Yes | 1-50 chars, letters/spaces/hyphens | "Pet name is required" |
| Pet Photo | No | 50MB max, JPG/PNG | "Photo too large - try smaller" |
| Effect Selection | No | One of 4 effects | Auto-select "Original" if skipped |
| Font Style | No | One of 6 fonts | Auto-select "Classic" if skipped |

---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation

**Tab Order**:
1. Pet name input
2. Saved pet card 1
3. Saved pet card 2
4. Saved pet card 3
5. Quick upload button
6. Upload & preview button
7. Send later button
8. Add to cart button

**Keyboard Shortcuts**:
- `Enter` on pet card: Select pet
- `Space` on buttons: Activate
- `Escape` on modal: Close modal
- `Tab`: Navigate forward
- `Shift+Tab`: Navigate backward

### Screen Reader Support

**Aria Labels**:
```html
<!-- Pet Selector Container -->
<div
  class="ks-pet-selector"
  role="region"
  aria-label="Pet customization options">

  <!-- Pet Name Input -->
  <label for="pet-name">
    Pet Name <span aria-label="required">*</span>
  </label>
  <input
    type="text"
    id="pet-name"
    aria-required="true"
    aria-describedby="pet-name-help pet-name-error"
    aria-invalid="false">
  <span id="pet-name-help">Required for personalization</span>
  <span id="pet-name-error" role="alert"></span>

  <!-- Saved Pet Card -->
  <button
    class="pet-card"
    aria-label="Select Bella, uploaded 2 days ago, original effect"
    aria-pressed="false">
    <img src="..." alt="Bella the dog" />
    <span>Bella</span>
  </button>

  <!-- Upload Button -->
  <button
    class="quick-upload-btn"
    aria-label="Quick upload - Upload photo now, process later">
    🚀 Quick Upload
  </button>

  <!-- Add to Cart Button -->
  <button
    type="submit"
    name="add"
    aria-disabled="true"
    aria-describedby="cart-status">
    Add to Cart
  </button>
  <span id="cart-status" aria-live="polite">
    Enter pet name above to enable checkout
  </span>
</div>
```

**Live Regions**:
```html
<!-- Status announcements -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only">
  <!-- JavaScript updates this with status messages -->
  <!-- Example: "Bella selected. Add to cart is now enabled." -->
</div>

<!-- Error announcements -->
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  class="sr-only">
  <!-- JavaScript updates this with error messages -->
  <!-- Example: "Upload failed. Please try again." -->
</div>
```

### Color Contrast

**Requirements**:
- Text on background: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 minimum

**Color Palette**:
```css
/* Accessible combinations */
--primary-text: #1a1a1a;        /* On white: 16.1:1 ✅ */
--secondary-text: #4a4a4a;       /* On white: 9.7:1 ✅ */
--link-blue: #0066cc;            /* On white: 4.5:1 ✅ */
--error-red: #cc0000;            /* On white: 5.7:1 ✅ */
--success-green: #008800;        /* On white: 4.6:1 ✅ */
--button-primary-bg: #0066cc;    /* White text: 7.1:1 ✅ */
--button-disabled-bg: #cccccc;   /* Dark text: 4.5:1 ✅ */
```

### Focus Indicators

**Focus States**:
```css
/* Visible focus ring on all interactive elements */
*:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove focus ring on mouse click, keep for keyboard */
*:focus:not(:focus-visible) {
  outline: none;
}

/* Special focus for pet cards */
.pet-card:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 4px;
  transform: scale(1.05);
}
```

### Touch Target Sizes

**Minimum sizes (WCAG 2.5.5)**:
- All buttons: 44x44px minimum
- Pet cards: 80x80px (exceeds requirement)
- Input fields: 44px height minimum
- Links: 44x44px tap area (padding)

---

## Technical Implementation Notes

### Form Data Structure

**Hidden fields required**:
```html
<input type="hidden" name="properties[_pet_name]" value="Bella">
<input type="hidden" name="properties[_has_custom_pet]" value="true">
<input type="hidden" name="properties[_processed_image_url]" value="https://...">
<input type="hidden" name="properties[_original_image_url]" value="https://...">
<input type="hidden" name="properties[_effect_applied]" value="original">
<input type="hidden" name="properties[_font_style]" value="classic">
<input type="hidden" name="properties[_upload_method]" value="express|preview|post-purchase">
<input type="hidden" name="properties[_artist_notes]" value="Customer will email photo">
```

**New field**: `_upload_method` values:
- `express`: Quick upload (async processing)
- `preview`: Full preview flow (already processed)
- `post-purchase`: Will upload via email link
- `saved`: Used existing saved pet

### LocalStorage Schema

**Pet data structure**:
```javascript
{
  "savedPets": [
    {
      "id": "uuid-1234",
      "name": "Bella",
      "originalUrl": "https://storage.googleapis.com/...",
      "gcsUrl": "https://storage.googleapis.com/...",
      "processedImage": "data:image/jpeg;base64,...", // Thumbnail
      "effect": "original",
      "uploadDate": "2025-10-15T10:30:00Z",
      "lastUsed": "2025-10-20T14:20:00Z"
    }
  ],
  "currentSelection": {
    "petId": "uuid-1234",
    "name": "Bella",
    "uploadMethod": "saved"
  }
}
```

### Event System

**Custom events to dispatch**:
```javascript
// When pet name entered
document.dispatchEvent(new CustomEvent('pet:name-entered', {
  detail: { name: 'Bella' }
}));

// When saved pet selected
document.dispatchEvent(new CustomEvent('pet:selected', {
  detail: {
    name: 'Bella',
    processedImage: '...',
    gcsUrl: '...',
    effect: 'original',
    uploadMethod: 'saved'
  }
}));

// When quick upload completes
document.dispatchEvent(new CustomEvent('pet:upload-complete', {
  detail: {
    name: 'Bella',
    uploadMethod: 'express',
    status: 'processing'
  }
}));

// When customer chooses post-purchase upload
document.dispatchEvent(new CustomEvent('pet:post-purchase-selected', {
  detail: {
    name: 'Bella',
    uploadMethod: 'post-purchase'
  }
}));
```

### Add to Cart Button Logic

**Update `cart-pet-integration.js`**:

```javascript
// Current logic (Lines 194-201):
initializeButtonState: function() {
  var petSelector = document.querySelector('[data-max-pets]');
  if (petSelector) {
    var hasSelectedPet = document.querySelector('[name="properties[_has_custom_pet]"]');
    if (!hasSelectedPet || hasSelectedPet.value !== 'true') {
      this.disableAddToCart();
    }
  }
}

// NEW logic (proposal):
initializeButtonState: function() {
  var petSelector = document.querySelector('[data-max-pets]');
  if (petSelector) {
    // Enable if pet name exists (regardless of photo upload status)
    var petNameField = document.querySelector('[name="properties[_pet_name]"]');
    if (!petNameField || !petNameField.value || petNameField.value.trim() === '') {
      this.disableAddToCart();
    } else {
      this.enableAddToCart();
    }
  }
}

// Listen for pet name input changes
document.getElementById('pet-name').addEventListener('input', function(e) {
  var name = e.target.value.trim();
  if (name.length > 0) {
    CartPetIntegration.enableAddToCart();
  } else {
    CartPetIntegration.disableAddToCart();
  }
});
```

---

## Post-Purchase Upload Flow

### Email Templates

**Immediate Confirmation Email** (Order placed without photo):

```
Subject: ✅ Order Confirmed - Upload Your Pet Photo

Hi [Customer Name]!

Thank you for your order (#12345)!

📸 NEXT STEP: Upload Your Pet's Photo

We need a photo of [Pet Name] to create your custom product.

[Upload Photo Now] ← Big CTA button

⏰ Upload Deadline: [Date + 24h] at 11:59 PM

What happens next:
1. Upload your photo (takes 10 seconds)
2. We'll process it with our AI (takes 5 minutes)
3. You'll receive a preview email for approval
4. We'll ship your order within 3-5 days

Photo Tips:
• Well-lit, clear image
• Close-up of pet's face
• No filters needed (our AI handles it!)
• Max size: 50MB

Need help? Just reply to this email!

Questions? Call us: (555) 123-4567

[Upload Photo Button]

---
Order Details:
Product: Custom Pet Mug
Pet Name: [Pet Name]
Order #: 12345
Total: $29.99
```

**Reminder Email 1** (12 hours after order):

```
Subject: 📸 Reminder: Upload [Pet Name]'s Photo

Hi [Customer Name],

Just a friendly reminder to upload [Pet Name]'s photo for
order #12345.

[Upload Photo Now]

Time remaining: 12 hours (deadline: [Date] 11:59 PM)

We're excited to create your custom product, but we need
that photo to get started!

Questions? Reply to this email or call (555) 123-4567

[Upload Photo Button]
```

**Final Reminder Email** (23 hours after order):

```
Subject: ⏰ URGENT: Photo Upload Deadline in 1 Hour

Hi [Customer Name],

This is your final reminder - we need [Pet Name]'s photo
within the next hour to process your order.

[Upload Photo Now] ← URGENT

Deadline: Tonight at 11:59 PM (1 hour from now)

What if I miss the deadline?
• Your order will be held (not cancelled)
• Reply to this email and we'll extend the deadline
• Or request a full refund (no questions asked)

We're here to help! Call us now: (555) 123-4567

[Upload Photo Button]
```

### Upload Landing Page

**URL**: `https://perkieprints.com/upload?order=12345&token=abc123`

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ 🐾 Upload [Pet Name]'s Photo                        │
│                                                      │
│ Order #12345                                         │
│ ⏰ Deadline: [Date] at 11:59 PM                     │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │                                                  ││
│ │         [Drag & Drop Photo Here]                ││
│ │                                                  ││
│ │         or                                       ││
│ │                                                  ││
│ │         [Browse Files]                           ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Photo Tips:                                          │
│ ✅ Well-lit, clear image                            │
│ ✅ Close-up of pet's face                           │
│ ✅ No filters needed                                │
│ ✅ Max size: 50MB                                   │
│                                                      │
│ [Upload & Preview] ← Primary CTA                    │
│                                                      │
│ Need more time?                                      │
│ [Request Extension] [Cancel Order]                  │
└─────────────────────────────────────────────────────┘
```

### Order Admin Workflow

**Shopify order properties**:
```
_pet_name: Bella
_upload_method: post-purchase
_upload_deadline: 2025-10-21T23:59:59Z
_upload_reminder_sent: 2
_photo_uploaded: false
_upload_token: abc123xyz789
```

**Production hold logic**:
```javascript
function canShipOrder(order) {
  // If upload method is post-purchase
  if (order.properties._upload_method === 'post-purchase') {
    // Check if photo has been uploaded
    if (!order.properties._photo_uploaded) {
      return {
        canShip: false,
        reason: 'Awaiting customer photo upload',
        deadline: order.properties._upload_deadline
      };
    }
  }

  // All other methods can ship immediately
  return { canShip: true };
}
```

---

## Success Metrics & KPIs

### Primary Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Conversion Rate | 1.73% | 4.0%+ | Add to cart / Product page views |
| Cart Abandonment | 69% | 40% | Abandoned carts / Initiated carts |
| Time to Purchase | 15-30s | 5-10s | Timestamp: Page load → Cart add |
| Mobile Conversion | Unknown | 75% of desktop | Mobile add to cart / Mobile views |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pet Name Completion Rate | 95%+ | Orders with pet name / Total orders |
| Upload Method Distribution | Track | Express / Preview / Post-purchase |
| Post-Purchase Upload Rate | 80%+ | Photos uploaded / Orders with post-purchase |
| Upload Deadline Extensions | <10% | Extension requests / Post-purchase orders |
| Refunds (No Photo) | <5% | Refunds due to no photo / Post-purchase orders |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wrong Pet Error Rate | <2% | Support tickets "wrong pet" / Orders |
| Upload Support Tickets | <5% | Upload-related tickets / Post-purchase orders |
| Accessibility Compliance | 100% | WCAG 2.1 AA audit score |
| Mobile Usability Score | 95+ | Google Lighthouse mobile score |

---

## A/B Testing Plan

### Test 1: Pet Name Position

**Hypothesis**: Placing pet name input above upload options increases completion rate

**Variants**:
- A (Control): Pet name below upload options
- B (Test): Pet name above upload options (proposed design)

**Success Metric**: Pet name completion rate
**Duration**: 1 week
**Expected Lift**: +15-25%

### Test 2: Upload Button Copy

**Hypothesis**: "Quick Upload" performs better than "Upload Now"

**Variants**:
- A: "Upload Now"
- B: "Quick Upload" (with subtitle)
- C: "Upload Photo"

**Success Metric**: Click-through rate on upload button
**Duration**: 1 week
**Expected Lift**: +10-20%

### Test 3: Post-Purchase Messaging

**Hypothesis**: Deadline urgency increases upload compliance

**Variants**:
- A: "Upload anytime after checkout"
- B: "Upload within 24 hours" (proposed)
- C: "Upload before we ship (24h)"

**Success Metric**: Post-purchase upload rate
**Duration**: 2 weeks
**Expected Lift**: +30-50%

---

## Phased Rollout Plan

### Phase 1: Pet Name Decoupling (Week 1)

**Goal**: Enable cart with pet name only (no photo required)

**Changes**:
1. Add visible pet name input field to product page
2. Update `cart-pet-integration.js` button logic
3. Enable cart when pet name entered
4. Add new form field: `_upload_method`

**Testing**:
- Verify pet name validation
- Test cart add with name only
- Confirm order properties populate correctly

**Success Criteria**:
- Cart adds successfully with pet name only
- No JavaScript errors
- Mobile usability maintained

### Phase 2: Quick Upload Modal (Week 2)

**Goal**: Add express upload option (no preview)

**Changes**:
1. Create quick upload bottom sheet component
2. Add "Quick Upload" button to pet selector
3. Implement async background processing
4. Send preview email when processing completes

**Testing**:
- Upload with quick upload button
- Verify background processing works
- Confirm preview email sends
- Test on real mobile devices

**Success Criteria**:
- Upload completes in <2s
- Background processing succeeds
- Preview email delivers within 5 minutes
- Mobile gestures work smoothly

### Phase 3: Post-Purchase Upload (Week 3)

**Goal**: Enable "send later" option

**Changes**:
1. Add "I'll send later" button
2. Create email reminder system
3. Build upload landing page
4. Implement admin production hold logic

**Testing**:
- Order with post-purchase option
- Verify reminder emails send
- Test upload landing page
- Confirm production holds order

**Success Criteria**:
- Reminders send at correct intervals
- Upload landing page works
- Orders hold until photo uploaded
- Token security validated

### Phase 4: Saved Pets Enhancement (Week 4)

**Goal**: One-click selection for returning customers

**Changes**:
1. Display saved pet cards on product page
2. Enable one-click selection
3. Auto-fill pet name from saved data
4. No processing required for saved pets

**Testing**:
- Select saved pet with one click
- Verify no re-processing occurs
- Confirm pet name auto-fills
- Test with multiple saved pets

**Success Criteria**:
- One-click selection works
- Add to cart enables immediately
- Pet data populates correctly
- Mobile cards are tap-friendly

---

## Design Assets Needed

### Wireframes

1. **Product Page - Pet Selector** (Mobile & Desktop)
   - Empty state (no saved pets)
   - Saved pets state (1-3 pets)
   - Name entered state
   - Photo uploaded state

2. **Quick Upload Modal** (Mobile Bottom Sheet)
   - Initial state
   - Upload in progress
   - Upload complete
   - Error state

3. **Add to Cart Button States** (Mobile & Desktop)
   - Disabled (no name)
   - Enabled (name only)
   - Enabled (name + photo)

4. **Upload Landing Page** (Post-Purchase)
   - Upload form
   - Success confirmation
   - Deadline warning

### Visual Design Mockups

1. **Pet Selector Component**
   - 375px width (iPhone SE)
   - 768px width (iPad)
   - 1440px width (Desktop)

2. **Button States**
   - Default, Hover, Active, Disabled
   - Focus states for accessibility

3. **Email Templates**
   - Order confirmation (no photo)
   - Reminder emails (12h, 23h)
   - Preview ready email

### Iconography

**Icons needed**:
- 🐾 Pet paw (brand)
- 🚀 Rocket (quick upload)
- 🎨 Palette (preview upload)
- 📧 Email (send later)
- ✅ Checkmark (success)
- ⚠️ Warning (error)
- ⏰ Clock (deadline)
- 📸 Camera (upload)
- 🔒 Lock (security)

**Specifications**:
- Format: SVG
- Size: 24x24px, 32x32px, 48x48px
- Color: Single color (CSS fill override)
- Style: Rounded, friendly, accessible

---

## Appendix: Competitor Analysis

### Vistaprint (Custom Business Cards)

**Upload Flow**:
1. Select product
2. Choose template OR upload design
3. Add to cart (template pre-selected)
4. Upload design during checkout (optional)

**What They Do Well**:
- Templates enable instant purchase
- Upload is optional enhancement
- Clear preview before shipping

**What We Can Learn**:
- Default-enabled cart button
- Upload as optional step
- Multiple upload touchpoints

### Shutterfly (Photo Gifts)

**Upload Flow**:
1. Select product
2. Add to cart immediately
3. Upload photo in cart review
4. OR upload after purchase via email

**What They Do Well**:
- Zero friction to cart
- Multiple upload opportunities
- Email upload link works great

**What We Can Learn**:
- Cart-first, upload-later approach
- Email upload is acceptable pattern
- Trust in post-purchase uploads

### Etsy (Custom Pet Portraits)

**Upload Flow**:
1. Add to cart (no upload)
2. Message seller after purchase
3. Seller requests photo
4. Manual back-and-forth

**What They Do Well**:
- Complete trust model
- Human communication preferred
- No tech barriers to purchase

**What We Can Learn**:
- Trust-based model works
- Upload doesn't need to be technical
- Email/message is fine

### Our Competitive Advantage

**Unique Position**:
1. **Speed**: 3s AI processing (vs 24-48h manual)
2. **Quality**: 4 effect previews (vs blind trust)
3. **Flexibility**: Upload now/later/during checkout
4. **Free**: Background removal at no cost

**Market Differentiation**:
- Fastest AI processing in industry
- Only provider with instant preview
- Most flexible upload options
- Best mobile experience

---

---

## Multi-Pet Product Support

### Executive Summary

**CRITICAL REQUIREMENT**: 44% of pet households own multiple pets, and our product catalog supports 1-10 pets per product (typically 1-3). The three-scenario design MUST gracefully handle multi-pet selection across all customer journeys.

**Technical Foundation**:
- Product metafield: `product.metafields.custom.max_pets` (default: 1, range: 1-10)
- Storage format: Comma-separated names `"Bella,Milo,Max"`
- Display format: Ampersand separator `"Bella & Milo & Max"`
- Counter display: `"2/3 pets selected"` (mobile-optimized)
- Form field: `properties[_pet_name]` contains all names
- Existing utilities: `pet-name-formatter.js` handles conversion

---

### Multi-Pet Design Principles

1. **Progressive Capacity**: Start simple (1 pet), scale elegantly to 3 pets
2. **Visual Clarity**: Always show counter when max_pets > 1
3. **Mobile-First**: Tap-friendly multi-selection with clear feedback
4. **Validation First**: Prevent exceeding max_pets before submission
5. **Graceful Display**: Format pet names for readability
6. **Universal Pattern**: Same multi-selection UX across all three scenarios

---

### Scenario 1: Returning Customer (Multi-Pet Order Lookup)

**User Goal**: "I ordered 3 pets before, need to use 2 of them for this product"

**Multi-Pet Order Lookup Flow**:
```
Product Page Load (max_pets = 3)
    ↓
Pet Selector Header shows: "Your Pets (0/3)"
    ↓
Customer taps "Ordering Again?" to expand order lookup form
    ↓
Customer enters pet names: "Bella, Milo"
(Only entering 2 of the 3 pets from previous order)
    ↓
Customer enters order number: "#1001"
    ↓
Customer taps "Retrieve My Pets"
    ↓
Loading state: "Looking up order #1001..." (2-3s)
    ↓
Backend retrieves order, finds 3 pets: Bella, Milo, Max
Filters to requested names: Bella, Milo
    ↓
SUCCESS: Pet images and data populate
Preview shows:
┌────────┐ ┌────────┐
│[thumb] │ │[thumb] │
│  Bella │ │  Milo  │
│Original│ │Pop Art │
└────────┘ └────────┘
    ↓
✅ Confirmation: "Bella & Milo retrieved from order #1001!"
Counter shows: "Your Pets (2/3)"
Form field populated: properties[_pet_name] = "Bella,Milo"
    ↓
Option to add 3rd pet: [+ Add Another Pet] button visible
    ↓
Add to Cart enabled → Checkout
```

**Time to Purchase**: 8-12 seconds (input + lookup + confirmation)

**UI Component: Retrieved Pets Display**

**Visual Layout** (Mobile - After Successful Order Lookup):
```
┌─────────────────────────────────────────────────────┐
│ ✅ Pets Retrieved (2/3)                     [Edit]  │
│                                                      │
│ Order #1001 - Purchased Jan 15, 2025                │
│                                                      │
│ ┌────────┐ ┌────────┐                               │
│ │[thumb] │ │[thumb] │                               │
│ │  Bella │ │  Milo  │                               │
│ │Original│ │Pop Art │                               │
│ └────────┘ └────────┘                               │
│                                                      │
│ ✅ Using your previous pet photos                   │
│                                                      │
│ [+ Add Another Pet] ← Optional 3rd pet              │
│                                                      │
│ Wrong pets? [Try Different Order]                   │
└─────────────────────────────────────────────────────┘
```

**Specifications**:
- Display: Read-only thumbnails (not selectable cards)
- Thumbnail size: 100x100px on mobile (120x120px desktop)
- Shows pet name + effect applied in previous order
- Counter shows retrieved/max: "(2/3)"
- No toggle behavior - pets already determined by order lookup
- Edit button allows re-lookup with different order number

**Order Lookup States**:

1. **Empty State** (Before lookup):
   - Collapsed "Ordering Again?" section
   - Message: "Have you ordered before?"
   - Add to Cart: Disabled (no pet name entered)

2. **Lookup in Progress**:
   - Loading spinner with progress message
   - Form fields disabled
   - Status: "Looking up order #1001..."
   - Add to Cart: Disabled
   - Duration: 2-3 seconds

3. **Partial Retrieval** (2/3 pets retrieved):
   - Thumbnails display for retrieved pets
   - Counter shows: "(2/3)"
   - Add to Cart: Enabled
   - Option: "+ Add Another Pet" button visible
   - Message: "Add 1 more pet or checkout now"

4. **Maximum Reached** (3/3 pets from order):
   - All 3 thumbnails displayed
   - Counter: "(3/3)" in green/success color
   - Add to Cart: Enabled with pulse animation
   - Message: "All pets retrieved! Ready to order."
   - "+ Add Another Pet" button hidden

5. **Edit/Re-lookup**:
   - Tap [Edit] or [Try Different Order] button
   - Returns to order lookup form
   - Previous data cleared
   - Customer can enter different order number

**Mobile Gestures**:
- Tap [Edit]: Re-open order lookup form
- Tap [+ Add Another Pet]: Navigate to upload page
- Swipe-down on thumbnails: Show original order details

**Accessibility**:
```html
<div class="retrieved-pets-display" role="region" aria-label="Retrieved pet information">
  <div class="order-info" aria-label="Order #1001, purchased January 15, 2025">
    <span>Order #1001 - Purchased Jan 15, 2025</span>
  </div>

  <div class="pet-thumbnails" role="list">
    <div class="pet-thumbnail" role="listitem">
      <img src="..." alt="Bella - Original effect" />
      <span class="pet-name">Bella</span>
      <span class="pet-effect">Original</span>
    </div>
    <div class="pet-thumbnail" role="listitem">
      <img src="..." alt="Milo - Pop Art effect" />
      <span class="pet-name">Milo</span>
      <span class="pet-effect">Pop Art</span>
    </div>
  </div>

  <button type="button" aria-label="Edit order lookup">Edit</button>
  <button type="button" aria-label="Add another pet to this order">
    + Add Another Pet
  </button>
</div>
```

---

### Scenario 2: New Customer with Preview (Multi-Pet Upload)

**User Goal**: "I want to see all 3 of my pets with different effects"

**Multi-Pet Preview Flow**:
```
Product Page Load (max_pets = 3)
    ↓
Pet Selector shows: "Your Pets (0/3)"
    ↓
Customer taps "Upload & Preview"
    ↓
Navigate to /pages/pet-background-remover
    ↓
--- Upload Pet 1 ---
Upload photo → Enter "Bella" → AI processing (3-11s)
Preview 4 effects → Select "Original" → "Add to Product"
    ↓
Return to product page
Counter shows: "Your Pets (1/3)"
✅ Bella selected!
[📸 Add Another Pet] button visible
    ↓
--- Upload Pet 2 (optional) ---
Customer taps "Add Another Pet"
Navigate back to /pages/pet-background-remover
Upload photo → Enter "Milo" → AI processing (3-11s)
Preview 4 effects → Select "Pop Art" → "Add to Product"
    ↓
Return to product page
Counter shows: "Your Pets (2/3)"
✅ Bella & Milo selected!
[📸 Add Another Pet] still visible
    ↓
--- Upload Pet 3 (optional) ---
Customer taps "Add Another Pet"
[Repeat process with "Max"]
    ↓
Counter shows: "Your Pets (3/3)"
✅ Bella, Milo & Max selected!
[📸 Add Another Pet] button hidden or disabled
    ↓
Add to Cart enabled → Checkout
```

**Time to Purchase**:
- 1 pet: 15-30s (single upload + preview)
- 2 pets: 40-60s (two rounds of upload)
- 3 pets: 60-90s (three rounds of upload)

**Key UX Enhancement**: "Add Another Pet" Button

**Visual States**:

```
State 1: After first pet uploaded (1/3)
┌─────────────────────────────────────────────────────┐
│ Your Pets (1/3)                                      │
│                                                      │
│ ┌────┐                                              │
│ │ ✅ │                                              │
│ │[img]│  ✅ Bella selected!                         │
│ │Bella│                                              │
│ └────┘                                              │
│                                                      │
│ [📸 Add Another Pet (Optional)]  ← Blue button      │
│                                                      │
│ [ Add to Cart ] ← Green button (enabled)            │
└─────────────────────────────────────────────────────┘

State 2: After second pet uploaded (2/3)
┌─────────────────────────────────────────────────────┐
│ Your Pets (2/3)                                      │
│                                                      │
│ ┌────┐ ┌────┐                                       │
│ │ ✅ │ │ ✅ │                                       │
│ │[img]│ │[img]│  ✅ Bella & Milo selected!          │
│ │Bella│ │Milo│                                       │
│ └────┘ └────┘                                       │
│                                                      │
│ [📸 Add 1 More Pet (Optional)]  ← Blue button       │
│                                                      │
│ [ Add to Cart ] ← Green button (enabled)            │
└─────────────────────────────────────────────────────┘

State 3: Maximum reached (3/3)
┌─────────────────────────────────────────────────────┐
│ Your Pets (3/3)                                      │
│                                                      │
│ ┌────┐ ┌────┐ ┌────┐                               │
│ │ ✅ │ │ ✅ │ │ ✅ │                               │
│ │[img]│ │[img]│ │[img]│  ✅ Bella, Milo & Max!      │
│ │Bella│ │Milo│ │Max │                               │
│ └────┘ └────┘ └────┘                               │
│                                                      │
│ ✨ All pets selected! Ready to order.               │
│                                                      │
│ [ Add to Cart ] ← Green button (enabled, pulsing)   │
└─────────────────────────────────────────────────────┘
```

**"Add Another Pet" Button Specs**:
- Label: Dynamic based on count
  - 1/3: "Add Another Pet (Optional)"
  - 2/3: "Add 1 More Pet (Optional)"
  - 3/3: Hidden or replaced with "Maximum Reached"
- Color: Secondary blue (not primary)
- Position: Below selected pets, above Add to Cart
- Action: Navigate to /pages/pet-background-remover with session context
- Mobile size: 44px height minimum

**Session Continuity**:
When returning from upload page, the pet selector must:
1. Retrieve all processed pets from localStorage
2. Display them with selection state maintained
3. Update counter to reflect new count
4. Enable "Add Another Pet" if under max_pets
5. Maintain form field with comma-separated names

**Technical Implementation**:
```javascript
// After pet is added via upload page
document.addEventListener('pet:uploaded', function(e) {
  const newPet = e.detail;
  const maxPets = parseInt(petSelector.dataset.maxPets) || 1;
  const currentCount = selectedPetsData.length;

  // Add new pet to selection
  selectedPetsData.push(newPet);

  // Update counter
  updatePetCounter(); // Shows X/Y

  // Update "Add Another Pet" button visibility
  const addAnotherBtn = document.getElementById('add-another-pet-btn');
  if (addAnotherBtn) {
    if (currentCount + 1 >= maxPets) {
      addAnotherBtn.style.display = 'none';
    } else {
      addAnotherBtn.textContent = `Add ${maxPets - currentCount - 1} More Pet${maxPets - currentCount - 1 > 1 ? 's' : ''} (Optional)`;
    }
  }

  // Update form field
  updatePetNamesFormField(); // Joins names with comma
});
```

---

### Scenario 3: Express Buyer (Multi-Pet Quick Entry)

**User Goal**: "I have 3 pets, want to skip preview, enter names quickly"

**Multi-Pet Express Flow - Option A: Sequential Quick Upload**

```
Product Page Load (max_pets = 3)
    ↓
Pet Selector shows: "Your Pets (0/3)"
Customer sees: "Upload Optional" state
    ↓
Customer taps "Quick Upload" button
    ↓
Quick Upload Modal opens (bottom sheet)
┌─────────────────────────────────────────────────────┐
│ 🚀 Quick Upload (1 of 3 pets)                       │
│                                                      │
│ Pet Name *                                           │
│ [Bella                          ]                    │
│                                                      │
│ Upload Photo *                                       │
│ [ 📸 Camera ] [ 📁 Gallery ]                        │
│                                                      │
│ [ Upload & Continue ]                                │
│ [Skip - Enter name only]                             │
└─────────────────────────────────────────────────────┘
    ↓
Upload completes (~1s) → "Bella uploaded!"
Modal shows: "Add another pet?"
    ↓
Customer taps "Yes, add another" → Modal resets for pet 2
┌─────────────────────────────────────────────────────┐
│ 🚀 Quick Upload (2 of 3 pets)                       │
│                                                      │
│ Pet Name *                                           │
│ [Milo                           ]                    │
│                                                      │
│ Upload Photo *                                       │
│ [ 📸 Camera ] [ 📁 Gallery ]                        │
│                                                      │
│ [ Upload & Continue ]                                │
│ [Done - Checkout with 2 pets]                       │
└─────────────────────────────────────────────────────┘
    ↓
Customer can continue until max_pets reached or chooses "Done"
    ↓
Final state: "Bella & Milo uploaded! Processing in background"
Counter shows: "Your Pets (2/3)"
Add to Cart enabled → Checkout
```

**Multi-Pet Express Flow - Option B: All-At-Once Name Entry**

```
Product Page Load (max_pets = 3)
    ↓
Pet Selector shows multi-input form inline:
┌─────────────────────────────────────────────────────┐
│ Your Pets (0/3)                                      │
│                                                      │
│ Pet Names (Required) *                               │
│                                                      │
│ Pet 1: [Bella                    ] [❌]             │
│ Pet 2: [Milo                     ] [❌]             │
│ Pet 3: [                         ] [❌]             │
│                                                      │
│ ▼ Pet Photos (Optional)                             │
│   [Quick Upload] [Upload & Preview] [Send Later]    │
│                                                      │
│ ℹ️ Enter names now, upload photos anytime           │
└─────────────────────────────────────────────────────┘
    ↓
Customer enters "Bella" in Pet 1 field
Counter updates: "Your Pets (1/3)"
    ↓
Customer enters "Milo" in Pet 2 field
Counter updates: "Your Pets (2/3)"
    ↓
Customer leaves Pet 3 empty (optional)
    ↓
Add to Cart enabled with 2 pet names
Form field: properties[_pet_name] = "Bella,Milo"
    ↓
Customer can:
  - Checkout immediately (no photos)
  - Tap "Quick Upload" to bulk upload 2 photos
  - Tap "Send Later" to upload via email
    ↓
Checkout completes
```

**Recommended Approach**: **Option B (All-At-Once)** for Express scenario

**Rationale**:
- Faster for customers who know all pet names
- No modal interruptions
- Clear visual of how many pets needed
- Mobile-optimized with dynamic field addition
- Supports both "names only" and "names + photos" paths

---

### Component: Multi-Pet Name Input Field

**Purpose**: Capture 1-3 pet names inline with progressive disclosure

**Visual Layout** (Mobile-First):

```
Initial State (0 pets entered):
┌─────────────────────────────────────────────────────┐
│ Pet Names (Required) *                               │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet 1: [                         ]              ││
│ │        Required for personalization             ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ [+ Add Another Pet] ← Shows if max_pets > 1         │
└─────────────────────────────────────────────────────┘

After entering first name:
┌─────────────────────────────────────────────────────┐
│ Pet Names (1/3 entered) *                            │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet 1: [Bella                    ] [❌]         ││
│ │        ✅ Name saved                             ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet 2: [                         ]              ││
│ │        Optional - Add if needed                  ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ [+ Add Pet 3] ← Shows if max_pets > 2               │
└─────────────────────────────────────────────────────┘

Maximum reached (3/3):
┌─────────────────────────────────────────────────────┐
│ Pet Names (3/3 - Maximum) *                          │
│                                                      │
│ Pet 1: [Bella                    ] [❌]             │
│ Pet 2: [Milo                     ] [❌]             │
│ Pet 3: [Max                      ] [❌]             │
│                                                      │
│ ✅ All pet names entered!                           │
└─────────────────────────────────────────────────────┘
```

**Specifications**:

1. **Dynamic Field Addition**:
   - Always show 1 field by default
   - Show "[+ Add Another Pet]" button if count < max_pets
   - Button label changes: "Add Pet 2", "Add Pet 3", etc.
   - Fields appear with smooth animation

2. **Field Validation** (Per Pet):
   - Required: First pet name only
   - Optional: Subsequent pet names
   - Max length: 50 characters per name
   - Real-time validation with inline feedback
   - Error state: Red border + error message

3. **Remove Functionality**:
   - [❌] button on each filled field (except first)
   - Tap to remove that pet name
   - Fields reorder automatically (no gaps)
   - Counter decrements

4. **Counter Integration**:
   - Header shows: "Pet Names (2/3 entered)"
   - Updates in real-time as fields are filled/cleared
   - Visual feedback: Counter turns green when >= 1 name

5. **Mobile Optimizations**:
   - Input type: `text`
   - Attributes: `autocapitalize="words"`, `autocorrect="off"`
   - 44px height minimum for tap targets
   - Keyboard dismiss button visible
   - Auto-scroll to new field when added

**HTML Structure**:
```html
<div class="pet-names-multi-input" data-max-pets="3">
  <div class="pet-names-header">
    <label for="pet-name-1">
      Pet Names <span class="counter">(0/3 entered)</span> *
    </label>
  </div>

  <div class="pet-name-fields" id="pet-name-fields">
    <!-- Field 1 - Always visible -->
    <div class="pet-name-field" data-pet-index="1">
      <label for="pet-name-1" class="sr-only">Pet 1 name</label>
      <input
        type="text"
        id="pet-name-1"
        class="pet-name-input"
        placeholder="e.g., Bella"
        required
        maxlength="50"
        autocapitalize="words"
        autocorrect="off"
        aria-describedby="pet-name-1-help">
      <span id="pet-name-1-help" class="help-text">Required for personalization</span>
    </div>
  </div>

  <button type="button"
          class="add-pet-btn"
          id="add-pet-btn"
          style="display: none;">
    <span aria-hidden="true">+</span> Add Another Pet
  </button>
</div>

<!-- Hidden form field for submission -->
<input type="hidden"
       name="properties[_pet_name]"
       id="pet-names-combined"
       value="">
```

**JavaScript Logic**:
```javascript
const PetNamesMultiInput = {
  maxPets: 3,
  currentFields: 1,
  petNames: [],

  init: function() {
    const container = document.querySelector('.pet-names-multi-input');
    this.maxPets = parseInt(container.dataset.maxPets) || 1;

    // Show "Add Another Pet" button if max_pets > 1
    if (this.maxPets > 1) {
      document.getElementById('add-pet-btn').style.display = 'block';
    }

    // Listen for input on all pet name fields
    this.attachInputListeners();
  },

  attachInputListeners: function() {
    const inputs = document.querySelectorAll('.pet-name-input');
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        this.updatePetName(index, e.target.value);
      });
    });
  },

  updatePetName: function(index, value) {
    this.petNames[index] = value.trim();

    // Update counter
    const filledCount = this.petNames.filter(n => n.length > 0).length;
    document.querySelector('.counter').textContent = `(${filledCount}/${this.maxPets} entered)`;

    // Update hidden form field (comma-separated)
    const combined = this.petNames.filter(n => n.length > 0).join(',');
    document.getElementById('pet-names-combined').value = combined;

    // Trigger validation and enable/disable Add to Cart
    this.validateAndEnableCart();
  },

  addPetField: function() {
    if (this.currentFields >= this.maxPets) return;

    this.currentFields++;
    const fieldsContainer = document.getElementById('pet-name-fields');

    // Create new field
    const fieldHtml = `
      <div class="pet-name-field" data-pet-index="${this.currentFields}">
        <label for="pet-name-${this.currentFields}" class="sr-only">Pet ${this.currentFields} name</label>
        <input
          type="text"
          id="pet-name-${this.currentFields}"
          class="pet-name-input"
          placeholder="e.g., ${this.getSamplePetName(this.currentFields)}"
          maxlength="50"
          autocapitalize="words"
          autocorrect="off"
          aria-describedby="pet-name-${this.currentFields}-help">
        <button type="button" class="remove-pet-btn" aria-label="Remove this pet">❌</button>
        <span id="pet-name-${this.currentFields}-help" class="help-text">Optional - Add if needed</span>
      </div>
    `;

    fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);

    // Attach listeners to new field
    this.attachInputListeners();

    // Hide button if max reached
    if (this.currentFields >= this.maxPets) {
      document.getElementById('add-pet-btn').style.display = 'none';
    }

    // Update button text
    document.getElementById('add-pet-btn').innerHTML =
      `<span aria-hidden="true">+</span> Add Pet ${this.currentFields + 1}`;
  },

  removePetField: function(index) {
    // Remove from array
    this.petNames.splice(index, 1);

    // Re-render all fields
    this.renderFields();
  },

  validateAndEnableCart: function() {
    const hasFirstPetName = this.petNames[0] && this.petNames[0].length > 0;
    const addToCartBtn = document.querySelector('[name="add"]');

    if (hasFirstPetName) {
      addToCartBtn.disabled = false;
      addToCartBtn.removeAttribute('aria-disabled');
    } else {
      addToCartBtn.disabled = true;
      addToCartBtn.setAttribute('aria-disabled', 'true');
    }
  },

  getSamplePetName: function(index) {
    const samples = ['Bella', 'Milo', 'Max', 'Luna', 'Charlie', 'Lucy'];
    return samples[index - 1] || 'Pet name';
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  PetNamesMultiInput.init();
});
```

---

### Multi-Pet Photo Upload Patterns

**Pattern 1: Bulk Upload (Recommended for Express)**

```
┌─────────────────────────────────────────────────────┐
│ Your Pets (2/3)                                      │
│                                                      │
│ Pet Names:                                           │
│ ✅ Bella  ✅ Milo  ⚪ [Add Pet 3]                   │
│                                                      │
│ Photos (Optional):                                   │
│                                                      │
│ Bella: [📸 Upload] or [Skip]                        │
│ Milo:  [📸 Upload] or [Skip]                        │
│                                                      │
│ Or:                                                  │
│ [📸 Upload All Photos] [📧 Send Later]             │
└─────────────────────────────────────────────────────┘
```

**Pattern 2: Inline Upload Per Pet**

```
┌─────────────────────────────────────────────────────┐
│ Your Pets (2/3)                                      │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet 1: [Bella          ] [📸] [❌]             ││
│ │        Photo: [No photo - Upload or send later] ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ Pet 2: [Milo           ] [📸] [❌]             ││
│ │        Photo: ✅ Uploaded (processing...)       ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ [+ Add Pet 3]                                        │
└─────────────────────────────────────────────────────┘
```

**Recommended**: **Pattern 1 (Bulk Upload)** for cleaner mobile UX

---

### Multi-Pet Form Field Format

**Storage Format** (Comma-separated):
```html
<input type="hidden" name="properties[_pet_name]" value="Bella,Milo,Max">
```

**Display Format** (Ampersand with spaces):
Using `pet-name-formatter.js`:
```javascript
// Storage → Display
PetNameFormatter.formatForDisplay("Bella,Milo,Max")
// Returns: "Bella, Milo & Max"

// Display → Storage
PetNameFormatter.formatForStorage("Bella, Milo & Max")
// Returns: "Bella,Milo,Max"
```

**Formatting Rules**:
- 1 pet: `"Bella"` → `"Bella"`
- 2 pets: `"Bella,Milo"` → `"Bella & Milo"`
- 3 pets: `"Bella,Milo,Max"` → `"Bella, Milo & Max"` (no Oxford comma)
- 4+ pets: `"A,B,C,D"` → `"A, B, C & D"` (no Oxford comma)

**Edge Cases**:
- Pet name with ampersand: `"Ben & Jerry,Max"` → `"Ben & Jerry & Max"`
- Empty values filtered: `"Bella,,Max"` → `"Bella,Max"` → `"Bella & Max"`
- Whitespace trimmed: `" Bella , Milo "` → `"Bella,Milo"` → `"Bella & Milo"`

---

### Multi-Pet Validation Rules

| Validation | Rule | Error Message |
|------------|------|---------------|
| **Minimum Pets** | At least 1 pet name required | "Please enter at least one pet name" |
| **Maximum Pets** | Cannot exceed `product.metafields.custom.max_pets` | "Maximum 3 pets allowed for this product" |
| **Name Length** | 1-50 characters per pet | "Pet name must be 1-50 characters" |
| **Name Format** | Letters, spaces, hyphens, apostrophes only | "Pet name can only contain letters and spaces" |
| **Duplicate Names** | Allow duplicates (e.g., "Max" & "Max") | No error - customer may have 2 pets with same name |
| **XSS Prevention** | No HTML tags or scripts | "Invalid characters in pet name" |
| **Photo Requirement** | Photos optional for all scenarios | No validation - photos always optional |

**JavaScript Validation**:
```javascript
function validateMultiPetSubmission(petNamesString, maxPets) {
  const names = petNamesString.split(',').map(n => n.trim()).filter(n => n.length > 0);

  // Check minimum (at least 1 pet)
  if (names.length === 0) {
    return { valid: false, error: 'Please enter at least one pet name' };
  }

  // Check maximum
  if (names.length > maxPets) {
    return { valid: false, error: `Maximum ${maxPets} pets allowed for this product` };
  }

  // Validate each name
  for (let i = 0; i < names.length; i++) {
    const name = names[i];

    // Length check
    if (name.length > 50) {
      return { valid: false, error: `Pet ${i + 1} name is too long (max 50 characters)` };
    }

    // Format check (letters, spaces, hyphens, apostrophes)
    if (!/^[A-Za-z\s\-']+$/.test(name)) {
      return { valid: false, error: `Pet ${i + 1} name contains invalid characters` };
    }

    // XSS check
    if (/<|>|script|iframe/i.test(name)) {
      return { valid: false, error: `Pet ${i + 1} name contains invalid characters` };
    }
  }

  return { valid: true, names: names };
}
```

---

### Multi-Pet Counter Display

**Purpose**: Show selection progress when max_pets > 1

**Display Logic**:
- Show counter ONLY if `max_pets > 1`
- Format: `(X/Y)` where X = selected count, Y = max allowed
- Position: Inline with "Your Pets" title (mobile-optimized)
- Real-time updates on selection/deselection

**Visual Treatment**:

```css
.ks-pet-selector__counter-inline {
  display: inline-flex;
  align-items: baseline;
  margin-left: 0.125rem; /* Minimal gap */
}

.ks-pet-selector__counter-inline .counter-text {
  font-size: 1.25rem;  /* Match title size */
  color: #666;  /* Slightly lighter for hierarchy */
  font-weight: 600;  /* Match title weight */
  white-space: nowrap;
}

/* Mobile optimization */
@media (max-width: 750px) {
  .ks-pet-selector__counter-inline .counter-text {
    font-size: 1.1rem;
  }
}
```

**State-Based Color Coding** (Optional):
```css
/* Empty state: Neutral gray */
.counter-text.state-empty {
  color: #999;
}

/* Partial: Blue (in progress) */
.counter-text.state-partial {
  color: #0066cc;
}

/* Maximum reached: Green (success) */
.counter-text.state-full {
  color: #008800;
}
```

**JavaScript Update Logic**:
```javascript
function updatePetCounter() {
  const maxPets = parseInt(petSelector.dataset.maxPets) || 1;
  const currentCount = selectedPetsData.length;

  // Only show counter if multiple pets allowed
  if (maxPets <= 1) {
    const existingCounter = document.getElementById(`pet-counter-${sectionId}`);
    if (existingCounter) existingCounter.remove();
    return;
  }

  // Find or create counter element
  let counterEl = document.querySelector('.ks-pet-selector__counter-inline');
  if (!counterEl) {
    const titleGroup = document.querySelector('.ks-pet-selector__title-group');
    counterEl = document.createElement('div');
    counterEl.className = 'ks-pet-selector__counter-inline';
    titleGroup.appendChild(counterEl);
  }

  // Determine state class
  let stateClass = 'state-empty';
  if (currentCount > 0 && currentCount < maxPets) stateClass = 'state-partial';
  if (currentCount === maxPets) stateClass = 'state-full';

  // Update counter HTML
  counterEl.innerHTML = `
    <span class="counter-text ${stateClass}"
          aria-label="Pet selection progress: ${currentCount} of ${maxPets} pets selected">
      (${currentCount}/${maxPets})
    </span>
  `;
}
```

---

### Multi-Pet Confirmation Messages

**Purpose**: Provide clear feedback on multi-pet selection

**Message Variations**:

```javascript
function getConfirmationMessage(petNames) {
  const count = petNames.length;

  if (count === 0) {
    return '';
  } else if (count === 1) {
    return `✅ ${petNames[0]} selected!`;
  } else if (count === 2) {
    return `✅ ${petNames[0]} & ${petNames[1]} selected!`;
  } else if (count === 3) {
    return `✅ ${petNames[0]}, ${petNames[1]} & ${petNames[2]} selected!`;
  } else {
    // 4+ pets
    return `✅ ${count} pets selected!`;
  }
}
```

**Display Location**:
- Below pet selection area
- Above "Add to Cart" button
- Green background for success state
- Animated entrance (slide up + fade in)

**Visual Design**:
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ ✅ Bella, Milo & Max selected!                  ││
│ │ Custom images will be added to cart             ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ [ Add to Cart ]                                      │
└─────────────────────────────────────────────────────┘
```

---

### Multi-Pet Mobile UX Summary

**Critical Mobile Optimizations**:

1. **Horizontal Scroll for Pet Cards**:
   - Cards: 100x100px with 8px gaps
   - Snap to alignment
   - Swipe indicators if > 4 cards
   - iOS/Android momentum scrolling

2. **Thumb-Zone Layout**:
   - Counter: Top (visual reference)
   - Pet cards: Middle (easy reach)
   - Add to Cart: Bottom (fixed position)

3. **Touch Feedback**:
   - Tap: Immediate checkmark animation
   - Long-press: Show pet details
   - Swipe: Navigate cards
   - Haptic feedback on selection (iOS)

4. **Minimal Vertical Space**:
   - Compact counter `(2/3)` instead of `"2 out of 3 pets selected"`
   - Inline messages
   - Collapsible photo upload section

5. **Performance**:
   - Lazy load pet thumbnails
   - Debounce counter updates
   - Cache formatted pet names
   - Smooth animations (60fps)

---

## Conclusion

This UX design specification provides a complete solution for handling three distinct customer scenarios while maintaining pet name as a universal requirement **and supporting multi-pet products (1-10 pets, typically 1-3)**. The design prioritizes mobile-first experience, removes conversion friction, and enables express checkout without sacrificing preview quality for customers who want it.

**Key Innovations**:
1. Pet name decoupled from photo upload
2. Three upload paths (express, preview, post-purchase)
3. **Order lookup for returning customers (no localStorage dependency)** - NEW
4. Mobile-optimized bottom sheet patterns
5. Trust-building messaging throughout
6. **Multi-pet counter and progressive capacity (1-3 pets)**
7. **Elegant pet name formatting (comma storage, ampersand display)**
8. **Cross-device pet retrieval via order number (portable, reliable)**

**Expected Impact**:
- +50-120% conversion improvement
- 5-10s time to purchase (vs 15-30s)
- 95%+ pet name capture rate
- 80%+ post-purchase upload compliance
- Market-leading mobile experience
- **44% of customers (multi-pet households) can purchase all pets in one transaction**
- **Zero localStorage expiry issues for returning customers**
- **Cross-device pet reuse (order number portable across phones/tablets)**

**Next Steps**:
1. Review this specification with stakeholders
2. Create visual mockups for Phase 1 **including multi-pet scenarios**
3. Begin technical implementation planning
4. Set up A/B testing infrastructure
5. Define success metrics dashboard
6. **Test multi-pet flows on real devices (iPhone/Android)**

---

**Status**: Ready for Technical Implementation Planning

**Dependencies**:
- Technical feasibility review by `mobile-commerce-architect`
- Backend upload flow design by `infrastructure-reliability-engineer`
- Conversion tracking setup by `shopify-conversion-optimizer`
- Implementation verification by `solution-verification-auditor`

**Estimated Implementation**: 4 weeks (phased rollout)
**Risk Level**: Low (non-breaking, reversible)
**ROI**: High (+$97k/year potential revenue + **44% customer base now fully supported**)
