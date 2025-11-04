# Pet Selector UX Improvements - Implementation Plan

**Date**: 2025-11-03
**Component**: `snippets/ks-product-pet-selector-stitch.liquid`
**Session**: 001
**Agent**: ux-design-ecommerce-expert

---

## Executive Summary

This plan addresses three user-requested UX improvements to the pet selector component, with special focus on the 70% mobile user base. The changes standardize visual hierarchy, update imagery, and improve label clarity through conditional logic.

**Estimated Implementation Time**: 45 minutes
**Risk Level**: Low (no breaking changes)
**Mobile Impact**: High (all changes benefit mobile experience)

---

## Change 1: Standardize All Section Headers

### Current State Analysis

**Inconsistency Identified**:
- **Line 36**: "Number of Pets" uses `<label class="pet-selector__label">` (1.125rem/18px, weight 700)
- **Line 53**: "Pet Details" uses `<h2 class="pet-selector__label">` (1.125rem/18px, weight 700)
- **Line 116**: "Choose Style" uses `<h2 class="pet-selector__heading">` (1.375rem/22px, weight 700)
- **Line 210**: "Choose Font" uses `<h2 class="pet-selector__heading">` (1.375rem/22px, weight 700)

**CSS Classes**:
```css
.pet-selector__label {
  font-size: 1.125rem;   /* 18px */
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.pet-selector__heading {
  font-size: 1.375rem;   /* 22px */
  font-weight: 700;
  margin: 0 0 1.5rem 0;
}
```

### UX Design Decision

**Recommended Approach**: Use `<h2>` with unified `.pet-selector__section-heading` class

**Rationale**:
1. **Semantic HTML**: All four items are section headers at the same hierarchy level
2. **Accessibility**: Screen readers treat them consistently as landmarks
3. **Mobile Optimization**: 18px (1.125rem) is ideal for mobile readability without overwhelming small screens
4. **Visual Hierarchy**: Maintains clear distinction from body text (14px) while not dominating the interface

**"Number of Pets" Special Case**:
- Currently uses `<label>` because it wraps radio buttons
- **Solution**: Move header outside the label wrapper, use `<h2>` for consistency
- The label functionality is preserved on individual pet count buttons

### Implementation Specification

**HTML Changes**:

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Line 35-36** (Number of Pets):
```liquid
<!-- BEFORE -->
<label class="pet-selector__label">Number of Pets</label>

<!-- AFTER -->
<h2 class="pet-selector__section-heading">Number of Pets</h2>
```

**Line 53** (Pet Details):
```liquid
<!-- BEFORE -->
<h2 class="pet-selector__label">Pet Details</h2>

<!-- AFTER -->
<h2 class="pet-selector__section-heading">Pet Details</h2>
```

**Line 116** (Choose Style):
```liquid
<!-- BEFORE -->
<h2 class="pet-selector__heading">Choose Style</h2>

<!-- AFTER -->
<h2 class="pet-selector__section-heading">Choose Style</h2>
```

**Line 210** (Choose Font):
```liquid
<!-- BEFORE -->
<h2 class="pet-selector__heading">Choose Font</h2>

<!-- AFTER -->
<h2 class="pet-selector__section-heading">Choose Font</h2>
```

**CSS Changes**:

**Location**: Inline `<style>` block, after line 356

**Add new unified class** (insert after `.pet-selector__label`):
```css
/* Unified section heading style - all section headers use this */
.pet-selector__section-heading {
  font-size: 1.125rem;        /* 18px - optimal for mobile readability */
  font-weight: 700;
  color: var(--pet-selector-text);
  margin: 0 0 0.75rem 0;      /* Consistent bottom spacing */
  line-height: 1.3;           /* Improved line height for multi-line wrapping */
}
```

**Deprecate old classes** (mark for future removal):
```css
/* DEPRECATED: Use .pet-selector__section-heading instead */
.pet-selector__label {
  /* Keep for backward compatibility in other components */
}

/* DEPRECATED: Use .pet-selector__section-heading instead */
.pet-selector__heading {
  /* Keep for backward compatibility in other components */
}
```

**Mobile Considerations**:
- 18px font size meets WCAG AAA readability standards on mobile
- 0.75rem (12px) bottom margin provides comfortable spacing without wasting vertical space
- Line-height 1.3 prevents awkward wrapping if headers are longer in other languages

---

## Change 2: Update Black & White Style Button Image

### Current State Analysis

**Line 127**:
```liquid
<img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
     alt="Black & White style preview"
     class="style-card__image">
```

**Current CSS** (lines 574-585):
```css
.style-card__image-wrapper {
  width: 5rem;              /* 80px */
  height: 5rem;             /* 80px */
  border-radius: 0.375rem;  /* 6px rounded corners */
  overflow: hidden;
}

.style-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;        /* Crops image to fill container */
}
```

### UX Design Decision

**Image Sizing Strategy**: Keep `object-fit: cover`

**Rationale**:
1. **Consistency**: All style preview images use the same 80×80px container with cover
2. **Mobile Touch Targets**: 80px meets Apple HIG (44px minimum) and Material Design (48px minimum) with comfortable padding
3. **Visual Alignment**: Cover ensures all preview images fill the circle uniformly
4. **B&W Specificity**: Black & white images naturally have high contrast, making cover's cropping less problematic

**Alternative Considered & Rejected**: `object-fit: contain`
- **Why rejected**: Would leave empty space in 80×80px container, making B&W preview appear smaller than other styles
- **When to use**: Only if user-provided image has essential details at edges that must be visible

### Implementation Specification

**Step 1: Asset Upload**
- **Action**: Save user-provided B&W image to Shopify theme assets
- **Filename**: `pet-bw-preview.jpg` (matches existing reference, no code change needed)
- **Location**: `assets/pet-bw-preview.jpg`
- **Recommended Specs**:
  - Dimensions: 160×160px minimum (2x for retina displays)
  - Format: JPG (smaller file size for B&W)
  - Quality: 85% compression (balance quality/performance)
  - Content: Centered pet portrait with clear subject

**Step 2: Image Optimization Checklist**
- [ ] Image cropped to square aspect ratio (1:1)
- [ ] Subject (pet) centered in frame
- [ ] High contrast black & white processing
- [ ] No essential details within 10px of edges (safe zone for cover crop)
- [ ] File size < 50KB for mobile performance

**CSS Verification** (no changes needed):
```css
/* Current implementation is correct */
.style-card__image-wrapper {
  width: 5rem;              /* ✓ Correct size */
  height: 5rem;             /* ✓ Maintains 1:1 ratio */
  border-radius: 0.375rem;  /* ✓ Softens corners nicely */
  overflow: hidden;         /* ✓ Clips to container */
}

.style-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;        /* ✓ KEEP THIS - ensures uniform fill */
}
```

**No Code Changes Required**: Only asset replacement needed.

### Mobile Considerations
- 80×80px (5rem) is large enough for finger taps even with padding
- Cover crop works well on mobile where space is premium
- Retina 2x image (160×160px) ensures crisp display on high-DPI mobile screens

### Edge Case: Image Quality Concerns
**If user-provided image looks poor with `object-fit: cover`**:
1. Request re-cropped image with centered subject
2. Verify image is at least 160×160px
3. Last resort: Add `.style-card__image--contain` modifier class for B&W only:

```css
/* ONLY add if absolutely necessary */
.style-card__image--contain {
  object-fit: contain;
  background-color: var(--pet-selector-gray-100);
}
```

---

## Change 3: Fix Pet Name Label Logic

### Current State Analysis

**Line 64** (current implementation):
```liquid
<p class="pet-detail__label-text">Pet's Name</p>
```

**Problem**: All three pets show "Pet's Name" with no numerical distinction.

**User Request**:
- Pet 1: "Pet's Name" (no number)
- Pet 2: "Pet 2's Name"
- Pet 3: "Pet 3's Name"

### UX Design Decision

**Approach**: Conditional Liquid logic with grammatically correct possessives

**Rationale**:
1. **Clarity**: First pet is implied default ("the pet"), subsequent pets need differentiation
2. **Natural Language**: "Pet's Name" reads more naturally than "Pet 1's Name" for single pet
3. **Scalability**: Logic extends cleanly if max_pets changes
4. **Accessibility**: Screen readers announce "Pet 2's Name" clearly vs "Pet 2 apostrophe s Name"

### Implementation Specification

**HTML Change**:

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Line 64** (inside the loop `{% for i in (1..3) %}`):

```liquid
<!-- BEFORE -->
<p class="pet-detail__label-text">Pet's Name</p>

<!-- AFTER -->
<p class="pet-detail__label-text">
  {% if i == 1 %}
    Pet's Name
  {% else %}
    Pet {{ i }}'s Name
  {% endif %}
</p>
```

**Expected Output**:
- When `i = 1`: "Pet's Name"
- When `i = 2`: "Pet 2's Name"
- When `i = 3`: "Pet 3's Name"

**CSS Verification** (no changes needed):
```css
.pet-detail__label-text {
  font-size: 0.875rem;      /* 14px - appropriate for label */
  font-weight: 500;
  color: var(--pet-selector-text);
  margin: 0 0 0.5rem 0;
}
```

### Mobile Considerations

**Text Length Analysis**:
- "Pet's Name": 10 characters
- "Pet 2's Name": 12 characters
- "Pet 3's Name": 12 characters

**Mobile Width Constraints**:
- iPhone SE (320px width): ~18-20 characters visible in label area
- Labels fit comfortably with no truncation risk

**Alternative Considered & Rejected**: Visual numbering with icons
```liquid
<!-- NOT RECOMMENDED -->
<p class="pet-detail__label-text">
  <span class="pet-number-badge">{{ i }}</span> Pet's Name
</p>
```

**Why rejected**:
1. Adds visual complexity without benefit
2. Increases vertical space usage on mobile
3. User request specifically asked for text-based numbering
4. Icon badges require additional CSS and testing

### Accessibility Considerations

**Screen Reader Behavior**:
- "Pet's Name" → "Pet's Name" (clear)
- "Pet 2's Name" → "Pet 2's Name" (clear enumeration)

**Form Label Association**:
```liquid
<label class="pet-detail__name-label">
  <p class="pet-detail__label-text"><!-- conditional text here --></p>
  <input type="text" name="properties[Pet {{ i }} Name]" ...>
</label>
```

The label wraps both text and input, maintaining proper form association for assistive technologies.

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review session context: `.claude/tasks/context_session_001.md`
- [ ] Backup current snippet: `ks-product-pet-selector-stitch.liquid.backup`
- [ ] Obtain user-provided B&W preview image
- [ ] Verify Shopify test URL is accessible

### Implementation Order

**Phase 1: CSS Updates** (5 minutes)
- [ ] Add `.pet-selector__section-heading` class to inline styles (after line 356)
- [ ] Add deprecation comments to `.pet-selector__label` and `.pet-selector__heading`
- [ ] Verify CSS syntax (no missing braces/semicolons)

**Phase 2: HTML Updates - Headers** (10 minutes)
- [ ] Update line 36: `<label>` → `<h2 class="pet-selector__section-heading">`
- [ ] Update line 53: `<h2 class="pet-selector__label">` → `<h2 class="pet-selector__section-heading">`
- [ ] Update line 116: `<h2 class="pet-selector__heading">` → `<h2 class="pet-selector__section-heading">`
- [ ] Update line 210: `<h2 class="pet-selector__heading">` → `<h2 class="pet-selector__section-heading">`
- [ ] Verify all closing tags present

**Phase 3: HTML Updates - Pet Labels** (5 minutes)
- [ ] Locate line 64 (inside `{% for i in (1..3) %}` loop)
- [ ] Replace static "Pet's Name" with conditional Liquid logic
- [ ] Verify indentation and Liquid tag syntax

**Phase 4: Asset Upload** (10 minutes)
- [ ] Process user-provided B&W image (crop to square, optimize)
- [ ] Upload to Shopify: `assets/pet-bw-preview.jpg`
- [ ] Verify image appears in theme asset list
- [ ] No code changes needed (filename matches existing reference)

**Phase 5: Deployment** (5 minutes)
- [ ] Commit changes: `git add snippets/ks-product-pet-selector-stitch.liquid`
- [ ] Commit message: "Standardize pet selector headers, update B&W preview, fix pet label numbering"
- [ ] Push to main: `git push origin main`
- [ ] Wait 2 minutes for GitHub → Shopify auto-deploy

**Phase 6: Testing** (10 minutes)
- [ ] Load Shopify test URL in Chrome DevTools MCP
- [ ] Test with 1 pet selected: Verify "Pet's Name" (no number)
- [ ] Test with 2 pets selected: Verify "Pet's Name" and "Pet 2's Name"
- [ ] Test with 3 pets selected: Verify "Pet's Name", "Pet 2's Name", "Pet 3's Name"
- [ ] Verify all section headers have consistent size/weight
- [ ] Verify B&W preview image displays correctly (80×80px, centered)
- [ ] Test on mobile viewport (375×667px): Check header readability, image clarity
- [ ] Test on desktop viewport (1280×720px): Check layout consistency

### Post-Implementation
- [ ] Update session context: `.claude/tasks/context_session_001.md`
- [ ] Create commit reference with testing notes
- [ ] Remove backup file (if tests pass)
- [ ] Archive session if task complete

---

## Testing Scenarios

### Desktop Testing (Chrome DevTools MCP)

**Test 1: Header Consistency**
1. Navigate to product page with custom tag
2. Inspect "Number of Pets", "Pet Details", "Choose Style", "Choose Font" headers
3. **Expected**: All headers 18px font size, 700 weight, 12px bottom margin
4. **Pass Criteria**: DevTools computed styles show identical values

**Test 2: Pet Label Logic - Single Pet**
1. Select "1" in Number of Pets selector
2. Inspect visible pet detail section
3. **Expected**: Label reads "Pet's Name" (no number)
4. **Pass Criteria**: Text content matches exactly, no "Pet 1"

**Test 3: Pet Label Logic - Multiple Pets**
1. Select "3" in Number of Pets selector
2. Inspect all three visible pet detail sections
3. **Expected**:
   - First section: "Pet's Name"
   - Second section: "Pet 2's Name"
   - Third section: "Pet 3's Name"
4. **Pass Criteria**: Text content matches exactly for all three

**Test 4: B&W Preview Image**
1. Locate "B&W" style card in Choose Style section
2. Inspect image element
3. **Expected**:
   - Image URL: `https://[shopify-domain]/assets/pet-bw-preview.jpg`
   - Image dimensions: 80×80px in container
   - No distortion or stretching
4. **Pass Criteria**: Image loads, fills container uniformly

### Mobile Testing (375×667px viewport)

**Test 5: Mobile Header Readability**
1. Set Chrome DevTools to iPhone SE viewport (375×667px)
2. Scroll through all sections
3. **Expected**: All headers fully visible, no text truncation, comfortable spacing
4. **Pass Criteria**: Headers readable without zooming

**Test 6: Mobile Image Scaling**
1. In mobile viewport, inspect "B&W" style card
2. **Expected**: 80×80px image remains clear, tappable, centered
3. **Pass Criteria**: Image crisp on retina display, no pixelation

**Test 7: Mobile Label Length**
1. In mobile viewport, select 3 pets
2. **Expected**: "Pet 2's Name" and "Pet 3's Name" labels fit in single line
3. **Pass Criteria**: No text wrapping or truncation on 375px width

### Accessibility Testing

**Test 8: Screen Reader Hierarchy**
1. Enable VoiceOver (Mac) or NVDA (Windows)
2. Navigate through pet selector with keyboard (Tab key)
3. **Expected**: All headers announced as "Heading level 2"
4. **Pass Criteria**: Consistent hierarchy, no skipped heading levels

**Test 9: Form Label Association**
1. Use screen reader to navigate pet name inputs
2. **Expected**: Screen reader announces "Pet's Name, Edit text" / "Pet 2's Name, Edit text"
3. **Pass Criteria**: Labels correctly associated with inputs

---

## Edge Cases & Considerations

### Edge Case 1: Long Pet Names in Mobile Viewport
**Scenario**: User enters 20+ character pet name
**Current Behavior**: Input width 100% of container, text scrolls horizontally
**Action**: No change needed, current implementation handles this correctly

### Edge Case 2: Product with max_pets = 1
**Scenario**: Product metafield `custom.max_pets = 1`
**Current Behavior**: Only "Pet's Name" label shown (pet count selector hidden)
**Action**: No change needed, conditional logic handles this correctly

### Edge Case 3: B&W Image Load Failure
**Scenario**: `pet-bw-preview.jpg` fails to load (404 error)
**Current Behavior**: Broken image icon in 80×80px container
**Mitigation**:
- Verify asset uploaded successfully before deployment
- Add alt text (already present): "Black & White style preview"
- Consider adding CSS fallback background color:

```css
/* Optional enhancement - not required for this task */
.style-card__image-wrapper {
  background-color: var(--pet-selector-gray-200);
}
```

### Edge Case 4: Non-English Language Support
**Scenario**: Store translated to language with longer words
**Current Behavior**: Headers may wrap to two lines
**Mitigation**:
- `line-height: 1.3` in `.pet-selector__section-heading` provides comfortable wrapping
- 0.75rem bottom margin prevents excessive vertical spacing
- No additional action needed

---

## Design Rationale Summary

### Why These Decisions Matter for Mobile (70% Traffic)

**Header Standardization**:
- Reduces cognitive load: consistent visual hierarchy
- Improves scannability: users recognize sections instantly
- Saves vertical space: 18px vs 22px headers reduce total page height by ~16px

**Image Optimization**:
- 80×80px touch target exceeds accessibility minimums
- `object-fit: cover` ensures visual consistency across all style cards
- Retina-ready image (160×160px) prevents pixelation on high-DPI mobile screens

**Label Clarity**:
- Natural language ("Pet's Name" vs "Pet 1's Name") reduces reading time
- Clear enumeration for multiple pets prevents user confusion
- Short text length (12 characters max) fits mobile viewports comfortably

### Conversion Impact Estimate
- **Reduced Friction**: Clearer labels → fewer hesitations during pet entry (est. 5-10s saved per user)
- **Improved Trust**: Consistent design → perception of quality and attention to detail
- **Mobile Completion Rate**: Better mobile UX → potentially 1-2% improvement in mobile checkout completion

---

## Files Modified

### Primary File
- **Path**: `snippets/ks-product-pet-selector-stitch.liquid`
- **Lines Changed**: 36, 53, 64, 116, 210, 356-363 (CSS addition)
- **Change Type**: Non-breaking (visual/text updates only)

### Assets
- **Added**: `assets/pet-bw-preview.jpg` (user-provided image)
- **Change Type**: New asset (no existing file overwritten)

---

## Rollback Plan

If issues arise post-deployment:

**Quick Rollback** (via Git):
```bash
git revert HEAD
git push origin main
```

**Manual Rollback** (if Git unavailable):
1. Restore from backup: `ks-product-pet-selector-stitch.liquid.backup`
2. Revert headers to original classes (`.pet-selector__label`, `.pet-selector__heading`)
3. Revert line 64 to static "Pet's Name"
4. Re-upload previous B&W preview image (if different)

**Risk Assessment**: Low
- No JavaScript changes (no runtime errors)
- No breaking HTML changes (structure preserved)
- CSS additions only (no overrides)
- Liquid logic is simple conditional (no complex loops)

---

## Next Steps After Implementation

1. **Monitor User Feedback**: Check for any reports of visual inconsistencies
2. **A/B Test Consideration**: If traffic permits, test header size impact on engagement
3. **Future Enhancements**:
   - Consider adding tooltips to style preview images (currently commented out)
   - Explore visual numbering badges as alternative to text labels
   - Add lazy loading to style preview images for performance

---

## Reference Links

- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Apple HIG Touch Targets**: https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/
- **Material Design Touch Targets**: https://material.io/design/usability/accessibility.html#layout-and-typography

---

**Plan Created By**: ux-design-ecommerce-expert
**Plan Reviewed By**: (Pending solution-verification-auditor review)
**Implementation By**: (To be assigned)
**Estimated Completion**: 45 minutes from implementation start
