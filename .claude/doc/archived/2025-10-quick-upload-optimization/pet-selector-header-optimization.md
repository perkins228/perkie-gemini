# Pet Selector Header Layout Optimization Plan

**Date**: September 20, 2025
**Context**: C:\Users\perki\OneDrive\Desktop\Perkie\Production\.claude\tasks\context_session_001.md
**Target File**: `snippets/ks-product-pet-selector.liquid`

## Current State Analysis

### HTML Structure
```html
<div class="ks-pet-selector__header-top">
  <h3 class="ks-pet-selector__title">Your Pets</h3>
  <!-- Counter inserted here via JavaScript -->
  <button class="ks-pet-selector__edit-btn">Edit</button>
</div>
```

### Current CSS Issues
1. **Excessive spacing**: `margin-left: 0.25rem` (4px) creates noticeable gap
2. **Inconsistent alignment**: Counter positioned via JavaScript insertion
3. **Mobile space waste**: Takes ~20px vertical with current implementation
4. **Visual disconnect**: Title and counter appear as separate elements

### Current JavaScript Behavior
- Counter dynamically inserted after title element
- Uses `insertBefore(counterEl, title.nextSibling)` for positioning
- Only shows when `maxPets > 1`

## Optimization Strategy

### 1. Flexbox Layout Approach (RECOMMENDED)

**Concept**: Create a nested flex container for title + counter as one visual unit

```css
.ks-pet-selector__header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ks-pet-selector__title-group {
  display: flex;
  align-items: baseline; /* Align text baselines for perfect visual integration */
  gap: 0.125rem; /* 2px - minimal spacing */
  flex-shrink: 0; /* Prevent shrinking on mobile */
}

.ks-pet-selector__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #333;
  line-height: 1.2; /* Consistent line height */
}

.ks-pet-selector__counter-inline {
  display: inline-flex;
  align-items: baseline;
  margin: 0; /* Remove all margins */
}

.ks-pet-selector__counter-inline .counter-text {
  font-size: 1.25rem; /* Match title exactly */
  color: #666; /* Slightly lighter for hierarchy */
  font-weight: 600; /* Match title weight */
  white-space: nowrap;
  line-height: 1.2; /* Match title line height */
}
```

### 2. CSS Changes for Tightest Spacing

**Key Optimizations**:
- Change `gap: 0.125rem` (2px) instead of `margin-left: 0.25rem` (4px)
- Use `align-items: baseline` for perfect text alignment
- Create `.ks-pet-selector__title-group` wrapper for visual unity

```css
/* Mobile optimizations - progressive spacing reduction */
@media (max-width: 750px) {
  .ks-pet-selector__title-group {
    gap: 0.0625rem; /* 1px on mobile */
  }

  .ks-pet-selector__counter-inline .counter-text {
    font-size: 1.1rem; /* Slightly smaller on mobile */
  }
}

@media (max-width: 400px) {
  .ks-pet-selector__title-group {
    gap: 0; /* No gap on very small screens */
  }

  .ks-pet-selector__counter-inline .counter-text {
    font-size: 1rem;
  }
}

/* Ultra-compact mode for tiny screens */
@media (max-width: 320px) {
  .ks-pet-selector__counter-inline {
    display: none; /* Hide counter entirely if space critical */
  }
}
```

### 3. Edit Button Positioning

**Strategy**: Use `margin-left: auto` to ensure right alignment regardless of title+counter width

```css
.ks-pet-selector__edit-btn {
  margin-left: auto; /* Push to right edge */
  flex-shrink: 0; /* Never shrink */
  min-width: 44px; /* Touch target minimum */
  height: 44px; /* Touch target minimum */
  /* Existing button styles... */
}
```

### 4. JavaScript Modifications

**Key Changes**:
1. Create title group wrapper
2. Insert counter inside title group
3. Maintain accessibility attributes

```javascript
function updatePetCounter() {
  const maxPets = parseInt(petSelector.dataset.maxPets) || 1;
  const currentCount = selectedPetsData.length;

  if (maxPets <= 1) {
    // Remove counter if it exists
    const existingCounter = document.getElementById(`pet-counter-${sectionId}`);
    if (existingCounter) {
      existingCounter.remove();
    }
    return;
  }

  // Find or create title group wrapper
  const headerTop = document.querySelector(`#pet-selector-header-${sectionId} .ks-pet-selector__header-top`);
  const title = headerTop?.querySelector('.ks-pet-selector__title');

  if (!title) return;

  // Create title group wrapper if it doesn't exist
  let titleGroup = title.parentElement.querySelector('.ks-pet-selector__title-group');
  if (!titleGroup) {
    titleGroup = document.createElement('div');
    titleGroup.className = 'ks-pet-selector__title-group';

    // Wrap title in the group
    title.parentElement.insertBefore(titleGroup, title);
    titleGroup.appendChild(title);
  }

  // Find or create counter within title group
  let counterEl = titleGroup.querySelector('.ks-pet-selector__counter-inline');
  if (!counterEl) {
    counterEl = document.createElement('div');
    counterEl.id = `pet-counter-${sectionId}`;
    counterEl.className = 'ks-pet-selector__counter-inline';
    titleGroup.appendChild(counterEl);
  }

  // Update counter content
  counterEl.innerHTML = `
    <span class="counter-text"
          aria-label="Pet selection progress: ${currentCount} of ${maxPets} pets selected">
      (${currentCount}/${maxPets})
    </span>
  `;
}
```

## Mobile vs Desktop Considerations

### Desktop (≥751px)
- **Gap**: 2px between title and counter
- **Font Size**: 1.25rem (matches title)
- **Color**: #666 (subtle hierarchy)

### Tablet (400-750px)
- **Gap**: 1px between title and counter
- **Font Size**: 1.1rem (slightly smaller)
- **Maintains**: Full functionality

### Mobile (≤400px)
- **Gap**: 0px (no gap)
- **Font Size**: 1rem (compact)
- **Touch Targets**: 44px minimum for edit button

### Ultra-Mobile (≤320px)
- **Counter**: Hidden entirely
- **Focus**: Maximum space for product content
- **Graceful**: Degrades without losing functionality

## Potential Pitfalls to Avoid

### 1. Accessibility Issues
- **Risk**: Screen readers not announcing counter properly
- **Solution**: Maintain ARIA labels and logical tab order
- **Test**: Verify with VoiceOver/NVDA

### 2. Layout Breaking
- **Risk**: Long pet names causing text overflow
- **Solution**: `white-space: nowrap` and `overflow: hidden` on counter
- **Fallback**: Progressive hiding on ultra-small screens

### 3. Performance Impact
- **Risk**: DOM manipulation on every counter update
- **Solution**: Cache title group reference after first creation
- **Optimization**: Only recreate if DOM structure changes

### 4. Cross-Browser Issues
- **Risk**: `baseline` alignment inconsistent across browsers
- **Solution**: Test on Safari, Chrome, Firefox mobile
- **Fallback**: Use `center` alignment if baseline fails

### 5. Theme Updates
- **Risk**: Shopify Dawn updates breaking custom CSS
- **Solution**: Use BEM naming that doesn't conflict with Dawn
- **Documentation**: Clear comments explaining custom modifications

## Implementation Steps

### Phase 1: CSS Structure (Low Risk)
1. Add `.ks-pet-selector__title-group` styles
2. Update `.ks-pet-selector__counter-inline` with baseline alignment
3. Modify mobile breakpoints for progressive spacing

### Phase 2: JavaScript Updates (Medium Risk)
1. Update `updatePetCounter()` function
2. Add title group wrapper creation logic
3. Test counter creation/removal cycles

### Phase 3: Testing & Refinement (Critical)
1. Test on staging URL with Playwright MCP
2. Verify on actual mobile devices (not just dev tools)
3. Check accessibility with screen readers
4. Validate cross-browser compatibility

## Success Metrics

### Quantitative
- **Space Reduction**: 50%+ reduction in header height
- **Visual Gap**: ≤2px between title and counter on desktop
- **Touch Targets**: 44px minimum maintained
- **Performance**: No additional DOM queries per update

### Qualitative
- **Visual Unity**: Title and counter appear as single element
- **Hierarchy**: Counter subordinate but visible
- **Mobile Experience**: Smooth interaction on 375px screens
- **Accessibility**: Full screen reader compatibility

## Rollback Plan

### If Issues Occur
1. **CSS Only**: Remove `.ks-pet-selector__title-group` styles
2. **JavaScript**: Revert to current insertion method
3. **Emergency**: Hide counter entirely with `display: none`

### Monitoring Points
- Cart abandonment rates (should not increase)
- Pet selection completion rates (should maintain/improve)
- Mobile bounce rates on product pages
- Support tickets about pet selector confusion

## Files Modified

### Primary
- `snippets/ks-product-pet-selector.liquid`
  - CSS section: Title group styles
  - JavaScript section: updatePetCounter() function

### Testing
- Staging URL verification via Playwright MCP
- Local testing files if staging unavailable

## Timeline

### Implementation: 2-3 hours
- 1 hour: CSS modifications and testing
- 1 hour: JavaScript function updates
- 30-60 minutes: Cross-device testing and refinement

### Deployment: Same day
- GitHub push to staging branch
- Automatic deployment to Shopify staging
- Validation on live staging environment