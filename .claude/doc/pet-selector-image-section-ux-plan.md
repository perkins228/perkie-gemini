# Pet Selector Image Section UX Plan

**Created**: 2025-11-04
**Task**: Restructure pet selector to improve information hierarchy by creating dedicated "Pet's Image" section
**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Impact**: UX clarity improvement, no functionality changes
**Mobile Traffic**: 70% (mobile-first critical)

---

## Executive Summary

**Current Problem**: The Upload and Preview buttons appear directly after the pet name input without clear visual grouping, creating confusion about the relationship between name and image upload functionality.

**Proposed Solution**: Create a visually distinct "Pet's Image" section with its own heading, grouping Upload button, file display, and Preview button together. This separates concerns and creates clear information hierarchy.

**UX Impact**:
- ✅ Clearer visual hierarchy (name vs. image are separate concerns)
- ✅ Improved scannability (section headings guide users)
- ✅ Better cognitive load (related actions grouped together)
- ✅ Enhanced mobile experience (clearer sections reduce scrolling confusion)
- ✅ Accessibility improvement (screen readers benefit from semantic structure)

**Risk Level**: LOW (display-only changes, all functionality preserved)

---

## UX Analysis

### Current Structure (Lines 61-116)

```liquid
<!-- Pet Detail Section (repeated for each pet) -->
<div class="pet-detail" data-pet-index="{{ i }}">

  <!-- Line 61-96: Combined Name + Upload Row -->
  <div class="pet-detail__row">
    <label class="pet-detail__name-label">
      <p class="pet-detail__label-text">
        Pet's Name                              ← Section heading
      </p>
      <input class="pet-detail__name-input">   ← Name input
      <div class="pet-detail__upload-status">  ← File display (hidden until upload)
        <!-- uploaded files list -->
      </div>
    </label>

    <div class="pet-detail__buttons">
      <button class="pet-detail__upload-btn">  ← Upload button (NO clear section)
        Upload
      </button>
      <button class="pet-detail__preview-btn"> ← Preview button (NO clear section)
        Preview
      </button>
    </div>
  </div>

  <!-- Line 98-105: Existing Print Checkbox -->
  <div class="pet-detail__checkbox-row">
    <label>Use Existing Perkie Print</label>
  </div>

  <!-- Line 107-115: Order Number Input -->
  <div class="pet-detail__order-input">
    <input placeholder="Enter previous order number">
  </div>

</div>
```

**Visual Layout (Current)**:
```
┌─────────────────────────────────────────────┐
│ Pet's Name                    [Upload] [Preview] │ ← All in one row
│ [___________________________]                    │
│ ✓ image1.jpg (2.4 MB)                           │ ← File display below name
├─────────────────────────────────────────────┤
│ ☐ Use Existing Perkie Print                    │
└─────────────────────────────────────────────┘
```

### Problems with Current Structure

1. **Unclear Relationship**: Upload/Preview buttons appear to be associated with the name input, but they operate on images
2. **No Visual Grouping**: File display appears between name and buttons, creating visual disconnect
3. **Weak Hierarchy**: Only one heading ("Pet's Name") for multiple distinct functions
4. **Mobile Confusion**: On mobile (lines 1019-1032), buttons stack below name creating even more confusion
5. **Cognitive Load**: Users must infer that Upload/Preview relate to image, not name
6. **Accessibility**: Screen reader users hear "Pet's Name" then immediately "Upload" button with no context

### Proposed Structure

```liquid
<!-- Pet Detail Section -->
<div class="pet-detail" data-pet-index="{{ i }}">

  <!-- Pet's Name Section (NEW: Standalone) -->
  <div class="pet-detail__section pet-detail__name-section">
    <h3 class="pet-detail__section-heading">Pet's Name</h3>
    <input class="pet-detail__name-input">
  </div>

  <!-- Pet's Image Section (NEW: Dedicated) -->
  <div class="pet-detail__section pet-detail__image-section">
    <h3 class="pet-detail__section-heading">Pet's Image</h3>

    <div class="pet-detail__image-actions">
      <button class="pet-detail__upload-btn">Upload</button>

      <!-- File display (existing) -->
      <div class="pet-detail__upload-status">
        <!-- uploaded files list -->
      </div>

      <button class="pet-detail__preview-btn">Preview</button>
    </div>
  </div>

  <!-- Existing Print Section (unchanged) -->
  <div class="pet-detail__section pet-detail__existing-print-section">
    <label>
      <input type="checkbox">
      Use Existing Perkie Print
    </label>
  </div>

  <!-- Order Number Input (unchanged) -->
  <div class="pet-detail__order-input">
    <input placeholder="Enter previous order number">
  </div>

</div>
```

**Visual Layout (Proposed)**:
```
┌─────────────────────────────────────────────┐
│ Pet's Name                                   │ ← Clear section
│ [_______________________________________]    │
├─────────────────────────────────────────────┤
│ Pet's Image                                  │ ← NEW: Clear section
│ [Upload]                                     │
│ ✓ image1.jpg (2.4 MB)                       │
│ [Preview]                                    │
├─────────────────────────────────────────────┤
│ ☐ Use Existing Perkie Print                 │
└─────────────────────────────────────────────┘
```

### UX Improvements

1. **Clear Separation of Concerns**:
   - Name section = identity
   - Image section = visual upload
   - Distinct headings make this explicit

2. **Improved Scannability**:
   - Users can quickly find "Pet's Image" section
   - Headings break up long form into digestible chunks

3. **Better Mobile Experience**:
   - Vertical stacking feels natural (section → action → result)
   - No ambiguity about what Upload/Preview operate on
   - Clearer visual breaks reduce scrolling fatigue

4. **Reduced Cognitive Load**:
   - Related actions grouped (Upload → Files → Preview)
   - Users don't need to infer relationships
   - Each section has clear purpose

5. **Accessibility Benefits**:
   - Screen readers announce "Pet's Image section" before Upload button
   - Semantic HTML improves navigation (heading landmarks)
   - Clear context for assistive technology users

6. **Consistent with Style/Font Sections**:
   - Lines 124, 240 already use `<h2 class="pet-selector__section-heading">`
   - New structure matches existing pattern
   - Visual consistency across entire form

---

## Design Recommendations

### Section Heading Style

**Recommendation**: Use `<h3>` with `.pet-detail__section-heading` class (styled to match `.pet-selector__section-heading`)

**Rationale**:
- Main sections (Number of Pets, Pet Details, Style, Font) use `<h2 class="pet-selector__section-heading">`
- Sub-sections within Pet Details should use `<h3>` for proper semantic hierarchy
- Visual style should match `<h2>` for consistency (users won't notice difference)

**CSS Specification**:
```css
.pet-detail__section-heading {
  /* Match existing .pet-selector__section-heading (line 391-397) */
  font-size: 1.125rem;        /* 18px */
  font-weight: 700;           /* Bold */
  color: var(--pet-selector-text);
  margin: 0 0 0.75rem 0;      /* 12px bottom margin */
  line-height: 1.3;
}
```

**Visual Weight**: Same as main section headings (maintains visual hierarchy consistency)

### Visual Grouping

**Background/Border Approach**: Subtle background differentiation

**Recommendation**:
```css
.pet-detail__section {
  /* Subtle background for visual separation */
  background-color: var(--pet-selector-background);
  padding: 1rem;                                    /* 16px internal spacing */
  border-radius: 0.5rem;                            /* 8px rounded corners */
  margin-bottom: 1rem;                              /* 16px between sections */
  border: 1px solid var(--pet-selector-gray-100);  /* Very subtle border */
}

/* Name section (minimal styling, it's just an input) */
.pet-detail__name-section {
  /* Could be even more minimal or match default */
}

/* Image section (needs more visual weight due to complexity) */
.pet-detail__image-section {
  /* Slightly stronger visual treatment */
  background-color: var(--pet-selector-gray-50);    /* Subtle gray tint */
  border-color: var(--pet-selector-gray-200);       /* Slightly stronger border */
}
```

**Vertical Spacing**:
- Between sections: `1rem` (16px) - enough for clear separation
- Between heading and content: `0.75rem` (12px) - matches existing pattern (line 395)
- Internal padding: `1rem` (16px) - comfortable breathing room

**Mobile Spacing** (max-width: 639px):
```css
@media (max-width: 639px) {
  .pet-detail__section {
    padding: 0.875rem;           /* 14px on mobile (slightly tighter) */
    margin-bottom: 0.875rem;     /* 14px between sections */
  }
}
```

### Button Layout

**Desktop Layout**: Vertical stack (Upload → Files → Preview)

**Rationale**:
- Upload first (initiation action)
- Files in middle (feedback/result)
- Preview last (next step action)
- Clear cause-and-effect flow

**Mobile Layout**: Same vertical stack (maintains consistency)

**Rationale**:
- Mobile already stacks buttons (lines 1024-1032)
- Vertical flow works better than horizontal on mobile
- No need for different layouts (simplifies code)

**Button Sizing**:
```css
.pet-detail__upload-btn,
.pet-detail__preview-btn {
  /* Current styles (lines 507-525) work well */
  width: 100%;                 /* Full width within image section */
  max-width: 300px;            /* Prevent excessive stretching on desktop */
  margin: 0 auto;              /* Center within section */

  /* Touch-friendly sizing (already 3rem = 48px height) */
  height: 3rem;                /* Meets WCAG 44px minimum */
  padding: 0 1.25rem;
}

/* Upload button (appears first) */
.pet-detail__upload-btn {
  margin-bottom: 0.75rem;      /* Space before file display */
}

/* Preview button (appears after files) */
.pet-detail__preview-btn {
  margin-top: 0.75rem;         /* Space after file display */
}
```

**Mobile Touch Targets**: Already optimized
- Buttons: 48px height (exceeds 44px WCAG minimum)
- Delete buttons: 44×44px invisible tap area (lines 878-897)
- No changes needed

### User Flow Improvements

**Before** (Current):
1. User sees "Pet's Name" heading
2. User enters name
3. User sees Upload button (unclear what it uploads)
4. User clicks Upload
5. User sees files appear below name input (confusing location)
6. User sees Preview button (unclear what it previews)

**After** (Proposed):
1. User sees "Pet's Name" heading → enters name ✅ Clear
2. User sees "Pet's Image" heading → knows next step ✅ Clear
3. User sees Upload button in Image section → clicks ✅ Obvious context
4. User sees files appear in Image section → natural location ✅ Expected
5. User sees Preview button in Image section → knows it previews image ✅ Obvious

**Additional UX Improvements to Consider**:

1. **Helper Text** (Optional):
   ```html
   <h3 class="pet-detail__section-heading">Pet's Image</h3>
   <p class="pet-detail__section-help">Upload up to 3 photos (max 50MB each)</p>
   ```
   - Provides context and constraints upfront
   - Reduces errors and support requests
   - Minimal visual weight (small, gray text)

2. **Icon Support** (Optional):
   ```html
   <h3 class="pet-detail__section-heading">
     <svg class="pet-detail__section-icon">📷</svg>
     Pet's Image
   </h3>
   ```
   - Visual cue for quick scanning
   - Helps non-English readers
   - Should be subtle (not distracting)

3. **Progressive Disclosure** (Future):
   - Could collapse Image section until name is entered
   - Guides users through natural flow
   - Reduces overwhelming form length
   - NOT recommended for initial implementation (adds complexity)

### Accessibility Considerations

**ARIA Labels**:
```html
<div class="pet-detail__section pet-detail__image-section"
     role="region"
     aria-labelledby="pet-image-heading-1">
  <h3 id="pet-image-heading-1" class="pet-detail__section-heading">
    Pet's Image
  </h3>
  <!-- content -->
</div>
```

**Screen Reader Flow**:
- Before: "Pet's Name, edit text, Upload button, Preview button" ❌ Confusing
- After: "Pet's Name section, edit text. Pet's Image section, Upload button, Preview button" ✅ Clear

**Keyboard Navigation**:
- Tab order: Name → Upload → Preview → Checkbox → Order Number
- No changes needed (DOM order determines tab order)
- Clear focus states already implemented (lines 495-499, 569-572)

**Focus Management**:
- After file upload, focus returns to Upload button (existing behavior)
- After Preview closes, focus returns to Preview button (existing behavior)
- No changes needed

---

## HTML Structure

### Before (Current - Lines 61-116)

```liquid
<div class="pet-detail" data-pet-index="{{ i }}" style="display: none;">

  <!-- Line 61-96: Combined row with name and buttons -->
  <div class="pet-detail__row">
    <label class="pet-detail__name-label">
      <p class="pet-detail__label-text">
        {% if i == 1 %}Pet's Name{% else %}Pet {{ i }}'s Name{% endif %}
      </p>
      <input type="text"
             class="pet-detail__name-input"
             name="properties[Pet {{ i }} Name]"
             placeholder="Enter name"
             data-pet-name-input="{{ i }}">

      <!-- File upload status - shown after files selected -->
      <div class="pet-detail__upload-status" data-upload-status="{{ i }}" style="display: none;"></div>
    </label>

    <div class="pet-detail__buttons">
      <button type="button"
              class="pet-detail__upload-btn"
              data-pet-upload-btn="{{ i }}">
        Upload
      </button>

      <!-- Native Shopify file upload -->
      <input type="file"
             name="properties[Pet {{ i }} Images]"
             accept="image/*"
             multiple
             style="display: none;"
             data-pet-file-input="{{ i }}"
             data-max-files="3"
             aria-label="Upload pet {{ i }} photo(s)">

      <button type="button"
              class="pet-detail__preview-btn"
              data-pet-preview-btn="{{ i }}">
        Preview
      </button>
    </div>
  </div>

  <!-- Line 98-105: Checkbox row -->
  <div class="pet-detail__checkbox-row">
    <label class="pet-detail__checkbox-label">
      <input type="checkbox"
             class="pet-detail__checkbox"
             data-existing-print-checkbox="{{ i }}">
      <span>Use Existing Perkie Print</span>
    </label>
  </div>

  <!-- Line 107-115: Order number input -->
  <div class="pet-detail__order-input"
       data-order-number-input="{{ i }}"
       style="display: none;">
    <input type="text"
           class="pet-detail__order-number"
           placeholder="Enter previous order number"
           name="properties[Pet {{ i }} Order Number]"
           data-order-number-field="{{ i }}">
  </div>

</div>
```

### After (Proposed)

```liquid
<div class="pet-detail" data-pet-index="{{ i }}" style="display: none;">

  <!-- NEW: Pet's Name Section (Standalone) -->
  <div class="pet-detail__section pet-detail__name-section">
    <h3 class="pet-detail__section-heading">
      {% if i == 1 %}Pet's Name{% else %}Pet {{ i }}'s Name{% endif %}
    </h3>
    <input type="text"
           class="pet-detail__name-input"
           name="properties[Pet {{ i }} Name]"
           placeholder="Enter name"
           data-pet-name-input="{{ i }}">
  </div>

  <!-- NEW: Pet's Image Section (Dedicated) -->
  <div class="pet-detail__section pet-detail__image-section"
       role="region"
       aria-labelledby="pet-image-heading-{{ i }}">
    <h3 id="pet-image-heading-{{ i }}" class="pet-detail__section-heading">
      Pet's Image
    </h3>

    <div class="pet-detail__image-actions">
      <!-- Upload Button -->
      <button type="button"
              class="pet-detail__upload-btn"
              data-pet-upload-btn="{{ i }}">
        Upload
      </button>

      <!-- Hidden file input (Shopify native upload) -->
      <input type="file"
             name="properties[Pet {{ i }} Images]"
             accept="image/*"
             multiple
             style="display: none;"
             data-pet-file-input="{{ i }}"
             data-max-files="3"
             aria-label="Upload pet {{ i }} photo(s)">

      <!-- File Display (shown after upload) -->
      <div class="pet-detail__upload-status"
           data-upload-status="{{ i }}"
           style="display: none;">
        <!-- File list populated by JavaScript -->
      </div>

      <!-- Preview Button -->
      <button type="button"
              class="pet-detail__preview-btn"
              data-pet-preview-btn="{{ i }}">
        Preview
      </button>
    </div>
  </div>

  <!-- Existing Print Section (Unchanged) -->
  <div class="pet-detail__checkbox-row">
    <label class="pet-detail__checkbox-label">
      <input type="checkbox"
             class="pet-detail__checkbox"
             data-existing-print-checkbox="{{ i }}">
      <span>Use Existing Perkie Print</span>
    </label>
  </div>

  <!-- Order Number Input (Unchanged) -->
  <div class="pet-detail__order-input"
       data-order-number-input="{{ i }}"
       style="display: none;">
    <input type="text"
           class="pet-detail__order-number"
           placeholder="Enter previous order number"
           name="properties[Pet {{ i }} Order Number]"
           data-order-number-field="{{ i }}">
  </div>

</div>
```

### Key Structural Changes

1. **Removed**:
   - `<div class="pet-detail__row">` (line 61) - no longer needed
   - `<label class="pet-detail__name-label">` (line 62) - replaced with section div
   - `<p class="pet-detail__label-text">` (line 63) - replaced with h3
   - `<div class="pet-detail__buttons">` (line 75) - replaced with image-actions div

2. **Added**:
   - `<div class="pet-detail__section pet-detail__name-section">` - new wrapper
   - `<h3 class="pet-detail__section-heading">` - new heading (2 instances)
   - `<div class="pet-detail__section pet-detail__image-section">` - new wrapper
   - `<div class="pet-detail__image-actions">` - new wrapper for buttons/files
   - ARIA attributes for accessibility

3. **Moved**:
   - Name input: From inside label to standalone in name section
   - Upload button: From buttons div to image-actions div
   - File display: From inside name label to inside image-actions div
   - Preview button: From buttons div to image-actions div
   - File input: Stays with Upload button (functionality unchanged)

---

## CSS Recommendations

### New Styles Needed

```css
/* === NEW: Pet Detail Section Containers === */

/* Base section styling for name/image subsections */
.pet-detail__section {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: var(--pet-selector-background);
  border: 1px solid var(--pet-selector-gray-100);
}

/* Name section (minimal styling) */
.pet-detail__name-section {
  /* Uses base .pet-detail__section styles */
}

/* Image section (slightly stronger visual weight) */
.pet-detail__image-section {
  background-color: var(--pet-selector-gray-50);
  border-color: var(--pet-selector-gray-200);
}

/* Section headings (matches main section heading style) */
.pet-detail__section-heading {
  font-size: 1.125rem;        /* 18px */
  font-weight: 700;
  color: var(--pet-selector-text);
  margin: 0 0 0.75rem 0;      /* 12px bottom spacing */
  line-height: 1.3;
}

/* Image actions container (vertical stack layout) */
.pet-detail__image-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;               /* 12px between elements */
}

/* === MODIFIED: Button Styles === */

/* Upload button (full width in section, centered) */
.pet-detail__upload-btn {
  /* Keep existing styles (lines 507-525) */
  position: relative;
  height: 3rem;
  padding: 0 1.25rem;
  background-color: var(--pet-selector-gray-100);
  border: none;
  border-radius: 40px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--pet-selector-gray-700);
  cursor: pointer;
  transition: background-color 0.2s;

  /* NEW: Full width layout */
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}

/* Preview button (matches Upload) */
.pet-detail__preview-btn {
  /* Keep existing styles */
  position: relative;
  height: 3rem;
  padding: 0 1.25rem;
  background-color: var(--pet-selector-gray-100);
  border: none;
  border-radius: 40px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--pet-selector-gray-700);
  cursor: pointer;
  transition: background-color 0.2s;

  /* NEW: Full width layout */
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}

/* Hover states (unchanged) */
.pet-detail__upload-btn:hover,
.pet-detail__preview-btn:hover {
  background-color: var(--pet-selector-gray-200);
}

/* Upload button with files indicator (unchanged) */
.pet-detail__upload-btn.has-uploads {
  background-color: #22c55e;
  color: white;
  font-weight: 600;
}

.pet-detail__upload-btn.has-uploads:hover {
  background-color: #16a34a;
}

/* === MODIFIED: Upload Status Display === */

/* File display container (now centered in image section) */
.pet-detail__upload-status {
  /* Keep existing styles (lines 809-815) */
  padding: 0.5rem;
  background-color: #f0fdf4;
  border-radius: 0.5rem;
  border: 1px solid #86efac;

  /* NEW: Full width in section */
  width: 100%;
  max-width: 300px;
  margin: 0 auto;              /* Center align */
}

/* File list items (unchanged - lines 817-843) */
.pet-detail__upload-status__file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
  color: #166534;
}

/* === MODIFIED: Name Input === */

/* Name input (now standalone, not in label) */
.pet-detail__name-input {
  /* Keep existing styles (lines 484-499) */
  width: 100%;
  height: 3rem;
  padding: 0 0.75rem;
  border: 1px solid var(--pet-selector-gray-300);
  border-radius: 0;
  font-size: 0.875rem;
  color: var(--pet-selector-text);
  background-color: var(--pet-selector-background);
}

.pet-detail__name-input:focus {
  outline: none;
  border-color: #ff5964;
  box-shadow: 0 0 0 2px rgba(255, 89, 100, 0.2);
}

/* === STYLES TO REMOVE/DEPRECATED === */

/* REMOVE: No longer needed after restructure */
.pet-detail__row {
  /* DELETE THIS RULE (lines 466-470) */
  /* display: flex; */
  /* gap: 1rem; */
  /* align-items: flex-end; */
}

.pet-detail__name-label {
  /* DELETE THIS RULE (lines 472-475) */
  /* flex: 1; */
  /* min-width: 0; */
}

.pet-detail__label-text {
  /* DELETE THIS RULE (lines 477-482) */
  /* font-size: 0.875rem; */
  /* font-weight: 500; */
  /* color: var(--pet-selector-text); */
  /* margin: 0 0 0.5rem 0; */
}

.pet-detail__buttons {
  /* DELETE THIS RULE (lines 501-505) */
  /* display: flex; */
  /* gap: 0.5rem; */
  /* flex-shrink: 0; */
}
```

### Mobile Optimizations

```css
/* Mobile responsiveness (max-width: 639px) */
@media (max-width: 639px) {
  /* Tighter section spacing on mobile */
  .pet-detail__section {
    padding: 0.875rem;           /* 14px (was 16px) */
    margin-bottom: 0.875rem;     /* 14px between sections */
  }

  /* Section heading (slightly smaller on mobile) */
  .pet-detail__section-heading {
    font-size: 1rem;             /* 16px (was 18px) */
    margin-bottom: 0.625rem;     /* 10px (was 12px) */
  }

  /* Buttons: Full width on mobile (remove max-width) */
  .pet-detail__upload-btn,
  .pet-detail__preview-btn {
    max-width: none;             /* Full width on mobile */
  }

  /* Upload status: Full width on mobile */
  .pet-detail__upload-status {
    max-width: none;             /* Full width on mobile */
  }

  /* REMOVE: Old mobile layout no longer needed */
  /* .pet-detail__row {
       flex-direction: column;
       align-items: stretch;
     } */

  /* REMOVE: Old button layout no longer needed */
  /* .pet-detail__buttons {
       width: 100%;
       justify-content: space-between;
     } */
}
```

### Accessibility CSS

```css
/* Skip to section link (for screen readers) */
.pet-detail__section[role="region"]:focus-within {
  outline: 2px solid #ff5964;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .pet-detail__section {
    border-width: 2px;
    border-color: var(--pet-selector-text);
  }

  .pet-detail__section-heading {
    font-weight: 800;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .pet-detail__upload-btn,
  .pet-detail__preview-btn {
    transition: none;
  }
}
```

---

## Implementation Steps

### Step 1: Backup Current File
```bash
cp snippets/ks-product-pet-selector-stitch.liquid snippets/ks-product-pet-selector-stitch.liquid.backup
```

### Step 2: Modify HTML Structure (Lines 61-116)

**Location**: `snippets/ks-product-pet-selector-stitch.liquid`

**Action**: Replace lines 61-116 with new structure

**Before** (DELETE lines 61-96):
```liquid
<div class="pet-detail__row">
  <label class="pet-detail__name-label">
    <p class="pet-detail__label-text">...</p>
    <input class="pet-detail__name-input"...>
    <div class="pet-detail__upload-status"...>
  </label>
  <div class="pet-detail__buttons">
    <button class="pet-detail__upload-btn"...>
    <input type="file"...>
    <button class="pet-detail__preview-btn"...>
  </div>
</div>
```

**After** (INSERT at line 61):
```liquid
<!-- Pet's Name Section -->
<div class="pet-detail__section pet-detail__name-section">
  <h3 class="pet-detail__section-heading">
    {% if i == 1 %}Pet's Name{% else %}Pet {{ i }}'s Name{% endif %}
  </h3>
  <input type="text"
         class="pet-detail__name-input"
         name="properties[Pet {{ i }} Name]"
         placeholder="Enter name"
         data-pet-name-input="{{ i }}">
</div>

<!-- Pet's Image Section -->
<div class="pet-detail__section pet-detail__image-section"
     role="region"
     aria-labelledby="pet-image-heading-{{ i }}">
  <h3 id="pet-image-heading-{{ i }}" class="pet-detail__section-heading">
    Pet's Image
  </h3>

  <div class="pet-detail__image-actions">
    <button type="button"
            class="pet-detail__upload-btn"
            data-pet-upload-btn="{{ i }}">
      Upload
    </button>

    <input type="file"
           name="properties[Pet {{ i }} Images]"
           accept="image/*"
           multiple
           style="display: none;"
           data-pet-file-input="{{ i }}"
           data-max-files="3"
           aria-label="Upload pet {{ i }} photo(s)">

    <div class="pet-detail__upload-status"
         data-upload-status="{{ i }}"
         style="display: none;"></div>

    <button type="button"
            class="pet-detail__preview-btn"
            data-pet-preview-btn="{{ i }}">
      Preview
    </button>
  </div>
</div>
```

**Lines affected**: 61-96 (36 lines deleted, ~50 lines inserted)

**Keep unchanged**: Lines 98-116 (checkbox and order input sections)

### Step 3: Add New CSS Styles (After Line 796)

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (CSS section)

**Action**: Insert new CSS after line 796 (after font preview styles)

**Insert at line 796** (after `.font-card__preview--trend`):
```css
/* === Pet Detail Section Containers === */

.pet-detail__section {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: var(--pet-selector-background);
  border: 1px solid var(--pet-selector-gray-100);
}

.pet-detail__name-section {
  /* Uses base section styles */
}

.pet-detail__image-section {
  background-color: var(--pet-selector-gray-50);
  border-color: var(--pet-selector-gray-200);
}

.pet-detail__section-heading {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--pet-selector-text);
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
}

.pet-detail__image-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
```

### Step 4: Modify Existing CSS (Lines 466-525, 809-815)

**Action**: Update button and status styles for new layout

**Line 507-525** (Upload/Preview buttons):
```css
/* ADD these properties to existing rules: */
.pet-detail__upload-btn,
.pet-detail__preview-btn {
  /* ...existing properties... */
  width: 100%;              /* NEW */
  max-width: 300px;         /* NEW */
  margin: 0 auto;           /* NEW */
}
```

**Line 809-815** (Upload status):
```css
/* ADD these properties to existing rule: */
.pet-detail__upload-status {
  /* ...existing properties... */
  width: 100%;              /* NEW */
  max-width: 300px;         /* NEW */
  margin: 0 auto;           /* NEW */
}
```

### Step 5: Remove Deprecated CSS (Lines 466-505)

**Action**: Delete or comment out old layout styles

**DELETE/COMMENT lines 466-505**:
```css
/* DEPRECATED: Old row layout (no longer used)
.pet-detail__row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.pet-detail__name-label {
  flex: 1;
  min-width: 0;
}

.pet-detail__label-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--pet-selector-text);
  margin: 0 0 0.5rem 0;
}

.pet-detail__buttons {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
*/
```

### Step 6: Update Mobile CSS (Lines 1018-1032)

**Action**: Replace mobile layout with new section-based approach

**DELETE lines 1019-1032**:
```css
/* DEPRECATED: Old mobile row layout
@media (max-width: 639px) {
  .pet-detail__row {
    flex-direction: column;
    align-items: stretch;
  }

  .pet-detail__buttons {
    width: 100%;
    justify-content: space-between;
  }

  .pet-detail__upload-btn,
  .pet-detail__preview-btn {
    flex: 1;
  }
}
*/
```

**INSERT at line 1018**:
```css
/* Mobile section layout */
@media (max-width: 639px) {
  .pet-detail__section {
    padding: 0.875rem;
    margin-bottom: 0.875rem;
  }

  .pet-detail__section-heading {
    font-size: 1rem;
    margin-bottom: 0.625rem;
  }

  .pet-detail__upload-btn,
  .pet-detail__preview-btn,
  .pet-detail__upload-status {
    max-width: none;
  }

  /* Keep existing modal styles (lines 1034-1051) */
}
```

### Step 7: Test JavaScript Compatibility

**Action**: Verify JavaScript selectors still work

**Check these functions** (lines 1297-1399):
- `displayUploadedFiles(petIndex, files)` - Uses `[data-upload-status="${petIndex}"]` ✅ Still works
- `removeFile(petIndex, fileIndex)` - Uses button `data-pet-upload-btn` ✅ Still works
- Upload button event (line 1189) - Uses `[data-pet-upload-btn="${i}"]` ✅ Still works
- File input event (line 1195) - Uses `[data-pet-file-input="${i}"]` ✅ Still works
- Preview button event (line 1467) - Uses `[data-pet-preview-btn="${i}"]` ✅ Still works

**No JavaScript changes needed** - All selectors use data attributes which remain unchanged

### Step 8: Deploy and Test

**Test on Shopify Test Environment**:
```bash
# Commit changes
git add snippets/ks-product-pet-selector-stitch.liquid
git commit -m "Improve pet selector UX: Create dedicated 'Pet's Image' section

- Separate name and image upload into distinct sections
- Add clear section headings for better hierarchy
- Improve mobile experience with vertical layout
- Enhance accessibility with ARIA landmarks
- No functionality changes, display only"

# Push to main (auto-deploys to Shopify)
git push origin main
```

**Wait 1-2 minutes for deployment**

**Test with Chrome DevTools MCP**:
1. Ask user for current Shopify test URL
2. Navigate to product page with pet selector
3. Test desktop layout (1024px+ width)
4. Test mobile layout (< 640px width)
5. Verify all functionality works

---

## Testing Checklist

### Visual Testing

**Desktop (1024px+)**:
- [ ] Pet name section displays with heading and input
- [ ] Pet image section displays with heading, upload, files, preview
- [ ] Sections have subtle background differentiation
- [ ] Section headings match style of main headings
- [ ] Buttons are centered and properly sized (max 300px width)
- [ ] Spacing between sections feels comfortable (1rem)

**Mobile (< 640px)**:
- [ ] Sections stack vertically without overlap
- [ ] Section padding is appropriate (0.875rem)
- [ ] Buttons expand to full width of section
- [ ] Text remains readable (no truncation)
- [ ] Touch targets remain 44px+ for accessibility

**Tablet (640px - 1023px)**:
- [ ] Layout scales appropriately between mobile/desktop
- [ ] No awkward breakpoints or layout shifts

### Functional Testing

**Upload Flow**:
- [ ] Upload button opens file picker
- [ ] Files display in image section (not name section)
- [ ] Upload button shows count: "Upload (2/3)"
- [ ] Green background appears when files uploaded
- [ ] Delete buttons work (files removed from display)

**Preview Flow**:
- [ ] Preview button disabled until upload
- [ ] Preview opens modal with processor
- [ ] Preview shows correct image
- [ ] Closing preview returns to product page
- [ ] State persists after preview

**Name Input**:
- [ ] Name input accepts text
- [ ] Font previews update with name changes
- [ ] Name persists in localStorage
- [ ] Name submits with form

**State Persistence**:
- [ ] Refresh page → state restores
- [ ] Navigate away → return → state restores
- [ ] Upload files → refresh → files display
- [ ] Select style/font → refresh → selections persist

**Multi-Pet Flow**:
- [ ] Select 2 pets → both sections appear
- [ ] Select 3 pets → all sections appear
- [ ] Each pet has independent upload/preview
- [ ] File uploads don't cross-contaminate

### Accessibility Testing

**Screen Reader** (NVDA/JAWS/VoiceOver):
- [ ] Section headings announced correctly
- [ ] Heading hierarchy is logical (H2 → H3)
- [ ] ARIA labels provide context for buttons
- [ ] Region landmarks navigate correctly
- [ ] File upload status announced

**Keyboard Navigation**:
- [ ] Tab order is logical (name → upload → preview)
- [ ] Enter key activates buttons
- [ ] Focus visible on all interactive elements
- [ ] No keyboard traps

**High Contrast Mode**:
- [ ] Section borders visible
- [ ] Headings stand out
- [ ] Buttons have clear boundaries

### Browser Testing

- [ ] Chrome (latest)
- [ ] Safari (latest - iOS and macOS)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari iOS 14+ (70% of mobile traffic)
- [ ] Chrome Android (latest)

### Performance Testing

- [ ] Page load time unchanged (< 2s)
- [ ] No layout shift (CLS) during load
- [ ] Smooth scrolling on mobile
- [ ] No jank when uploading files

### Regression Testing

**Existing Functionality**:
- [ ] Pet count selector works
- [ ] Style selector works
- [ ] Font selector works
- [ ] Existing print checkbox works
- [ ] Order number input works
- [ ] Form submission works
- [ ] Add to cart works
- [ ] localStorage persistence works
- [ ] Session restoration works

---

## Rollback Plan

If issues occur, rollback is simple:

```bash
# Restore backup file
cp snippets/ks-product-pet-selector-stitch.liquid.backup snippets/ks-product-pet-selector-stitch.liquid

# Commit and push
git add snippets/ks-product-pet-selector-stitch.liquid
git commit -m "Rollback pet selector restructure due to [REASON]"
git push origin main
```

**Alternative**: Revert specific commit:
```bash
# Find commit hash
git log --oneline | grep "Pet's Image section"

# Revert commit
git revert <commit-hash>
git push origin main
```

---

## Success Metrics

**Qualitative Indicators**:
- Reduced user confusion about upload functionality
- Clearer visual hierarchy in user testing
- Positive feedback on section organization
- Improved accessibility score (Lighthouse/WAVE)

**Quantitative Metrics** (Monitor via Analytics):
- Upload completion rate (should maintain or improve)
- Time to first upload (should decrease)
- Preview usage rate (should maintain)
- Add to cart conversion (should maintain)
- Mobile bounce rate on pet selector (should decrease)
- Form abandonment rate (should decrease)

**No Change Expected**:
- Total orders (functionality unchanged)
- Average order value (no impact)
- Pet processor usage (unaffected)

---

## Future Enhancements

**Not included in this implementation** (consider for future):

1. **Helper Text**:
   - Add upload constraints below heading: "Upload up to 3 photos (max 50MB each)"
   - Reduces errors and support requests

2. **Icon Support**:
   - Add camera icon to "Pet's Image" heading
   - Visual scanning improvement for all users

3. **Progressive Disclosure**:
   - Collapse image section until name is entered
   - Guides users through natural flow
   - Requires JavaScript changes

4. **Drag-and-Drop Upload**:
   - Add drop zone in image section
   - Improves desktop UX

5. **Image Preview Thumbnails**:
   - Show tiny thumbnail next to file name
   - Visual confirmation of correct file

6. **Validation Messaging**:
   - Show inline error messages in image section
   - "Please upload at least 1 photo" before Add to Cart

---

## Notes

**Why This Works**:
- Separates concerns (name identity vs. image upload)
- Matches user mental model (name first, then image)
- Consistent with existing section pattern (Style, Font)
- Minimal code changes (low risk)
- No functionality changes (no regression risk)

**Why Not Alternative Approaches**:

**Alternative 1**: Keep single row, add icon to Upload button
- ❌ Doesn't solve visual hierarchy problem
- ❌ Still unclear relationship on mobile
- ❌ Doesn't improve scannability

**Alternative 2**: Use accordion/collapsible sections
- ❌ Adds complexity (JavaScript state management)
- ❌ May hide important functionality
- ❌ Extra clicks required (friction)

**Alternative 3**: Side-by-side layout (Name left, Image right)
- ❌ Breaks on mobile (70% traffic)
- ❌ Harder to scan vertically
- ❌ Less flexible for future additions

**Why Vertical Sections Are Best**:
- ✅ Mobile-first (70% traffic)
- ✅ Clear hierarchy (top → bottom)
- ✅ Scannable (headings guide eye)
- ✅ Flexible (easy to add sections)
- ✅ Accessible (logical tab order)
- ✅ Consistent (matches Style/Font)

---

## Files Modified

1. `snippets/ks-product-pet-selector-stitch.liquid`
   - Lines 61-116: HTML structure changes
   - Lines 466-505: CSS deprecation/removal
   - Lines 507-525: Button style updates
   - Lines 796+: New section CSS
   - Lines 809-815: Upload status style updates
   - Lines 1018-1032: Mobile CSS updates
   - **Total changes**: ~150 lines modified/added, ~40 lines removed

**No other files affected** - This is a self-contained change

---

## Conclusion

This UX restructure improves information hierarchy and user clarity without changing any functionality. It's a low-risk, high-impact improvement that aligns with mobile-first design principles and accessibility best practices.

The clear separation of "Pet's Name" and "Pet's Image" sections helps users understand what information is needed and where actions apply, reducing cognitive load and improving conversion rates.

**Implementation Time**: 1-2 hours
**Testing Time**: 1-2 hours
**Total Effort**: 2-4 hours
**Risk Level**: LOW
**User Impact**: HIGH (positive)
