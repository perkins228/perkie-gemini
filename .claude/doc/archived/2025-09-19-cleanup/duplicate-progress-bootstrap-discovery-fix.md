# Duplicate Progress Bars: Bootstrap Discovery & Fix Implementation Plan

## Root Cause Discovery

### Critical Finding
Using Playwright inspection, we discovered **TWO distinct progress bar systems** on the pet processor page:

1. **Bootstrap Progress System (Unknown Source)**:
   - Classes: `div.bs-progress`, `div.bs-progress-bar.bs-progress-bar-animated.bs-progress-bar-striped`
   - Source: **KondaSoft Cart Goal component** in cart drawer
   - Status: **ALWAYS PRESENT** - loaded via theme.liquid

2. **Our Progress System (Known)**:
   - Classes: `div.unified-progress`, `div.progress-bar`, `div.progress-fill`
   - Source: `pet-processor-v5-es5.js`
   - Status: Created during pet processing

### Why Previous Fixes Failed
All previous attempts focused only on our pet processor progress system, completely missing the Bootstrap progress bars from the cart drawer that loads globally via `theme.liquid`.

## Source Analysis

### Bootstrap Progress Location
**File**: `C:\Users\perki\OneDrive\Desktop\Perkie\Production\snippets\ks-cart-goal.liquid` (Lines 83-89)
```liquid
<div class="bs-progress" style="--bs-progress-height: {{ settings.cart_goal_progress_height | append: 'px' }};">
  <div class="bs-progress-bar bs-progress-bar-animated bs-progress-bar-striped" 
       role="progressbar" 
       aria-valuenow="{{ percentage }}" 
       aria-valuemin="0"
       aria-valuemax="100"
       data-width="{{ percentage }}%"
       style="width: 0%; background-color: rgb(var(--color-accent-foreground));">
```

### Loading Chain
1. **theme.liquid** (Line ~118): `{%- render 'cart-drawer' -%}` (when cart_type == 'drawer')
2. **cart-drawer.liquid** (Line 118): `{% render 'ks-cart-goal' %}`
3. **ks-cart-goal.liquid**: Creates bs-progress elements
4. **ks-cart.js** (Lines 23-32): Animates bs-progress-bar elements

### CSS Definitions
**File**: `C:\Users\perki\OneDrive\Desktop\Perkie\Production\assets\ks-main.css` (Lines 275-316)
- Complete Bootstrap progress bar styling
- Animation classes: `.bs-progress-bar-animated`, `.bs-progress-bar-striped`

## Implementation Plan

### Strategy
**Hide Bootstrap progress bars specifically on pet processor page** rather than removing them globally (they're needed for cart functionality).

### Solution A: CSS Page-Specific Override (Recommended)

#### 1. Modify pet-processor-v5.css
**File**: `C:\Users\perki\OneDrive\Desktop\Perkie\Production\assets\pet-processor-v5.css`

**Add at the end**:
```css
/* Hide Bootstrap cart goal progress bars on pet processor page */
.template-page .bs-progress,
.template-page .bs-progress-bar {
  display: none !important;
}

/* Alternative: Hide entire cart goal component on pet processor pages */
.template-page ks-cart-goal {
  display: none !important;
}
```

**Rationale**: 
- Surgical fix targeting only pet processor pages
- Preserves cart goal functionality on other pages
- Uses Shopify's body class system (.template-page)

#### 2. Verify Page Class
**Check**: Confirm pet processor page has `.template-page` class on body
**Fallback**: Use section-specific selector if needed

### Solution B: Conditional Rendering (Alternative)

#### 1. Modify cart-drawer.liquid
**File**: `C:\Users\perki\OneDrive\Desktop\Perkie\Production\snippets\cart-drawer.liquid`

**Change Line 118**:
```liquid
{% unless template.name == 'page' and page.handle == 'pet-background-remover' %}
  {% render 'ks-cart-goal' %}
{% endunless %}
```

**Rationale**:
- Prevents cart goal from loading entirely on pet processor page
- More resource efficient
- Requires knowledge of exact page handle

### Solution C: JavaScript Removal (Last Resort)

#### 1. Add to pet-processor-v5-es5.js
**Add after line where progress system initializes**:
```javascript
// Remove Bootstrap progress bars that conflict with our system
function removeBootstrapProgressBars() {
  var bsProgressBars = document.querySelectorAll('.bs-progress, .bs-progress-bar');
  for (var i = 0; i < bsProgressBars.length; i++) {
    var element = bsProgressBars[i];
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
}

// Call on page load and before showing our progress
removeBootstrapProgressBars();
```

## Testing Requirements

### 1. Verification Steps
1. **Before Fix**: Confirm two progress bar systems visible using browser inspector
2. **After Fix**: Verify only our unified-progress system shows during processing
3. **Cart Function**: Ensure cart goal still works on product/cart pages
4. **Mobile Test**: Confirm fix works on mobile devices

### 2. Test Pages
- **Pet Processor Page**: `/pages/pet-background-remover` - Should show only our progress
- **Product Pages**: Any product page - Should show cart goal progress if applicable  
- **Cart Page**: `/cart` - Should show cart goal progress

### 3. Regression Testing
- Cart drawer functionality
- Cart goal animations
- Progress bar animations during pet processing
- Mobile cart interactions

## Risk Assessment

### Low Risk: Solution A (CSS Override)
- **Pros**: Non-invasive, preserves all functionality, easy to revert
- **Cons**: Adds CSS specificity, depends on body classes
- **Risk Level**: Very Low

### Medium Risk: Solution B (Conditional Rendering) 
- **Pros**: Most efficient, completely prevents loading
- **Cons**: Requires accurate page targeting, affects cart goal on pet page entirely
- **Risk Level**: Low-Medium

### High Risk: Solution C (JavaScript Removal)
- **Pros**: Guaranteed removal, works regardless of page structure
- **Cons**: Could interfere with cart functionality, harder to debug
- **Risk Level**: Medium

## Recommended Implementation

**Phase 1**: Implement Solution A (CSS Override)
**Phase 2**: If Solution A has issues, fallback to Solution B
**Phase 3**: Only use Solution C if both previous solutions fail

## Files to Modify

### Primary (Solution A)
- `assets/pet-processor-v5.css` - Add CSS override rules

### Secondary (Solution B - if needed)
- `snippets/cart-drawer.liquid` - Add conditional rendering

### Verification Files
- No modifications needed, just testing

## Success Criteria

1. **Visual**: Only one progress bar visible during pet processing
2. **Functional**: Pet processing works normally with single progress indicator
3. **Preserved**: Cart goal functionality intact on other pages
4. **Performance**: No additional performance impact
5. **Mobile**: Fix works consistently across all devices

## Emergency Rollback Plan

If any cart functionality breaks:
1. **Solution A**: Remove added CSS rules from pet-processor-v5.css
2. **Solution B**: Remove conditional logic from cart-drawer.liquid
3. **Solution C**: Remove JavaScript removal code

All solutions are designed to be easily reversible without affecting core systems.