# Pet Selector Text Cutoff Debug Analysis & Implementation Plan

**Session**: 001  
**Date**: 2025-09-05  
**Issue**: Text descenders in "Add your pet photo" being cut off  
**Priority**: HIGH - UI/UX defect affecting user experience  

## Root Cause Analysis

### Problem Identification ✅
**Symptom**: Descenders of 'y' and 'p' in "Add your pet photo" are visually cut off  
**Location**: `snippets/ks-product-pet-selector.liquid` lines 693-704  
**Component**: `.ks-pet-selector__empty-compact .ks-pet-selector__empty-text`  

### Root Cause Confirmation ✅
**Primary Cause**: `line-height: 1` on line 700 is insufficient for text with descenders

**Typography Analysis**:
- **Font size**: 14px
- **Current line-height**: 1 (14px total line height)
- **Descender requirement**: Typically 20-30% of font size below baseline
- **Missing space**: ~3-4px needed for proper descender rendering

**CSS Context**:
```css
.ks-pet-selector__empty-compact .ks-pet-selector__empty-text {
  font-size: 14px;
  line-height: 1;  /* ← ROOT CAUSE: Too restrictive */
  overflow: hidden; /* ← Clips descenders */
}
```

### Contributing Factors
1. **Compact Layout**: Design prioritizes minimal vertical space
2. **Overflow Hidden**: Clips content that extends beyond container
3. **Flexbox Context**: Parent layout may impose additional constraints
4. **Mobile Priority**: 70% mobile traffic requires careful spacing

## Technical Solution

### Recommended Fix
**Change line-height from 1 to 1.2**

**Rationale**:
- **1.2 = 16.8px** total line height (vs 14px current)
- **Adds 2.8px** vertical space for descenders
- **Industry Standard**: 1.2-1.4 is optimal for UI text readability
- **Minimal Impact**: Only 2.8px increase maintains compact design

### Alternative Values Considered
- **line-height: 1.1** (15.4px) - May still clip in some fonts
- **line-height: 1.3** (18.2px) - Too much space for compact design
- **line-height: 1.15** (16.1px) - Borderline, may work but 1.2 is safer

## Implementation Plan

### Step 1: CSS Modification
**File**: `snippets/ks-product-pet-selector.liquid`  
**Line**: 700  
**Change**:
```css
/* BEFORE */
line-height: 1;

/* AFTER */
line-height: 1.2;
```

### Step 2: Impact Assessment

#### Layout Stability ✅ EXPECTED SAFE
- **Vertical Impact**: +2.8px height increase
- **Flexbox Container**: Should accommodate gracefully
- **Compact Layout**: Still maintains compact appearance
- **Text Overflow**: Still functions with ellipsis

#### Mobile Considerations ✅ OPTIMIZED
- **Touch Targets**: No impact on button sizing
- **Viewport Space**: 2.8px increase is negligible on mobile
- **Readability**: Improved text clarity for mobile users
- **Performance**: No performance impact

#### Cross-Browser Compatibility ✅ UNIVERSAL
- **CSS Property**: line-height widely supported
- **Fallback**: Not needed - universal support
- **Mobile Browsers**: Full support across all mobile browsers

### Step 3: Testing Strategy

#### Visual Verification
1. **Desktop Testing**: Confirm descenders fully visible
2. **Mobile Testing**: Verify layout remains compact
3. **Font Rendering**: Test across different font weights/styles
4. **Edge Cases**: Long text with ellipsis still works

#### Browser Testing
- **Chrome/Safari**: Primary mobile browsers
- **Firefox**: Desktop compatibility
- **Edge**: Windows compatibility
- **iOS Safari**: iPhone testing priority

## Risk Assessment

### Implementation Risk: **LOW** 🟢
- **Single Property**: Only line-height changes
- **Non-Breaking**: Cannot cause layout failures
- **Reversible**: Easy to revert if issues arise
- **Isolated**: No dependencies on other components

### Business Impact: **POSITIVE** 🟢
- **User Experience**: Improved text readability
- **Professional Appearance**: Eliminates visual defect
- **Mobile UX**: Better for 70% mobile traffic
- **Brand Quality**: Maintains design standards

## Verification Checklist

### Pre-Implementation ✅
- [x] Root cause identified and confirmed
- [x] Solution researched and validated
- [x] Impact assessment completed
- [x] Risk analysis performed

### Post-Implementation
- [ ] Descenders fully visible in desktop browser
- [ ] Mobile layout remains compact and functional
- [ ] Text ellipsis still works for long content
- [ ] No layout shifts or alignment issues
- [ ] Cross-browser testing completed

## Alternative Solutions (Not Recommended)

### Option 1: Adjust Container Height
**Pros**: More explicit control  
**Cons**: Complex layout changes, risk of breaking responsive design

### Option 2: Remove Overflow Hidden
**Pros**: Allows natural text flow  
**Cons**: Breaks compact design, text may overlap other elements

### Option 3: Use Different Font
**Pros**: Smaller descenders  
**Cons**: Brand consistency concerns, requires design approval

## Implementation Details

### Files to Modify
1. **Primary**: `snippets/ks-product-pet-selector.liquid`
   - Line 700: Change `line-height: 1;` to `line-height: 1.2;`

### No Additional Files Required
- No new files needed
- No asset changes required
- No JavaScript modifications needed

### Deployment
- **Method**: Git commit to staging branch
- **Auto-deploy**: GitHub integration deploys to Shopify staging
- **Testing**: Use Playwright MCP with staging URL
- **Rollback**: Simple git revert if needed

## Context Integration

### Session Context Update
Will append implementation results to `.claude/tasks/context_session_001.md`

### Documentation
This plan serves as complete implementation documentation for the text cutoff fix.

---

## Final Recommendation

**IMPLEMENT**: Change `line-height: 1` to `line-height: 1.2` in `.ks-pet-selector__empty-compact .ks-pet-selector__empty-text`

**Confidence**: HIGH - Low risk, high benefit fix  
**Priority**: HIGH - Visual defect affecting user experience  
**Complexity**: MINIMAL - Single CSS property change  
**Impact**: POSITIVE - Improved readability and professional appearance