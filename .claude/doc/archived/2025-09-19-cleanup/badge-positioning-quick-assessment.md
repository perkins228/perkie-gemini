# Quick UX Assessment: Badge Positioning on Pet Thumbnails

## Current Issue
- Selection badges (32px circles with numbers 1,2,3) positioned at `top: 4px, right: 52px`
- User reports badges are covering pet faces in thumbnails
- User suggests moving to bottom-right corner

## Quick Assessment

### 1. Is bottom-right better than current position?

**NO - Bottom-right is worse for this use case.**

**Critical UX issues with bottom-right positioning:**

1. **Text Collision**: Will definitely interfere with pet name text below image
   - Pet names appear in `.ks-pet-selector__pet-info` section directly below thumbnails
   - Text already uses full width of thumbnail area
   - Adding badge at bottom-right creates visual noise and readability issues

2. **Mobile Thumb Zone Conflict**: For 70% mobile users
   - Bottom-right is prime scrolling area for right-handed users
   - Higher accidental touch risk during list navigation
   - Interferes with natural swipe gestures

3. **Visual Hierarchy Problem**: 
   - Selection badges need to be immediately visible for task completion
   - Bottom position competes with pet name for attention
   - Users scan top-to-bottom, badges get buried

### 2. Will this interfere with pet name text below image?

**YES - Guaranteed interference.**

Current layout structure:
```
[Image thumbnail 100px height]
[Pet info section with name + effect]
```

Bottom-right badge would overlay the pet info section, creating:
- Text readability issues
- Visual clutter 
- Layout breaking on mobile

### 3. Better alternatives?

**SOLUTION: Keep current positioning but optimize for face coverage**

The current `top: 4px, right: 52px` is actually optimal because:

1. **Spatial separation**: Doesn't conflict with delete button at `right: 4px`
2. **Mobile-optimized**: Outside accidental touch zones
3. **Maintains visual hierarchy**: Clear scan pattern for selection state

**If faces are being covered, the real solutions are:**

#### Option A: Reduce Badge Size (Quick Fix)
- Reduce from 32px to 24px on mobile
- Position at `top: 4px, right: 56px` for more spacing
- Maintains visibility while reducing face coverage

#### Option B: Top-Left Corner (Alternative)
- Position at `top: 4px, left: 4px` 
- Less likely to cover pet faces (most pets face camera center)
- Still maintains accessibility for mobile users

#### Option C: Outside Image Bounds
- Position badges on the thumbnail border/frame
- Requires restructuring HTML layout
- Most complex but cleanest solution

## Recommendation

**Keep current positioning** - the user's perception of "covering faces" may be more about badge size than position.

**Quick fix**: Reduce badge size to 24px and test with actual user photos before major repositioning.

The current top-right (offset) position is UX-optimal for multi-selection workflows.