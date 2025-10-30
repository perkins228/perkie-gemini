# Banner Text Lower Positioning - Implementation Plan

**Date:** September 22, 2025
**Issue:** User needs banner text to appear LOWER than current "Bottom center" (80%) positioning
**Context:** Homepage hero launch requirement, 70% mobile traffic, user explicitly wants NO over-engineering
**Priority:** CRITICAL - Homepage launch blocker

## Current State Analysis

### Current Bottom Positioning Values
- **All bottom positions**: Currently set to 80% Y-axis placement
- **Positions affected**: bottom-left, bottom-center, bottom-right (lines 191, 196, 198, 202)
- **File**: `sections/image-banner.liquid`
- **Safety margin**: 80% provides 20% clearance from bottom edge

### User Requirements
- Text needs to appear **LOWER** than current 80% bottom positioning
- **NO over-engineering** - wants simplest solution
- Must work for both desktop and mobile (70% mobile traffic)
- Homepage hero launch depends on this fix

## Recommended Solution: SIMPLE VALUE ADJUSTMENT

### Option 1: Change 80% to 90% (RECOMMENDED)
**Simplest approach - just move bottom positions lower**

**Changes Required:**
1. Update all bottom positions from `80` to `90` in `sections/image-banner.liquid`
2. Lines to modify:
   - Line 191: `assign final_y = 90` (bottom-left)
   - Line 193: `assign final_my = 90` (bottom-left mobile)
   - Line 196: `assign final_y = 90` (bottom-center)
   - Line 198: `assign final_my = 90` (bottom-center mobile)
   - Line 202: `assign final_y = 90` (bottom-right)
   - Line 202: `assign final_my = 90` (bottom-right mobile)

**Impact:**
- Moves text 10% lower (closer to bottom edge)
- Maintains 10% safety clearance from absolute bottom
- Works consistently across all devices
- Zero risk - purely aesthetic adjustment

### Alternative Rejected Options

**Option 2: Add "Very Bottom" Grid Position**
- Would add 4th row to grid (very-bottom-left, very-bottom-center, very-bottom-right)
- Rejected: User wants NO over-engineering, current grid sufficient

**Option 3: Expand Manual Slider Range**
- Allow manual sliders to go beyond 100%
- Rejected: Over-complicates existing system, user wants simple fix

**Option 4: Add Custom CSS Override**
- Rejected: Not Shopify-native, adds complexity

## Implementation Details

### File to Modify
- **File**: `sections/image-banner.liquid`
- **Lines**: 191, 193, 196, 198, 202 (6 total line changes)
- **Change Type**: Simple numeric value updates

### Before/After Values
```liquid
# BEFORE (Current - 80%)
when 'bottom-left'
  assign final_y = 80
  assign final_my = 80

# AFTER (Proposed - 90%)
when 'bottom-left'
  assign final_y = 90
  assign final_my = 90
```

### Positioning Logic Preserved
- Grid selector continues to override manual sliders
- Custom positioning checkbox behavior unchanged
- All other positions (top, center) remain at current values
- Transform centering with `translate(-50%, -50%)` maintained

## Mobile Considerations (70% Traffic)

### Mobile Safety
- 90% positioning on mobile maintains readability
- Mobile screens typically have navigation bars at bottom
- 10% clearance prevents text collision with UI elements
- Touch targets remain unaffected

### Responsive Behavior
- Same 90% value used for both desktop (`final_y`) and mobile (`final_my`)
- Consistent visual behavior across all screen sizes
- No additional media queries required

## Risk Assessment

### MINIMAL RISK ✅
- **No breaking changes**: Pure aesthetic adjustment
- **No new functionality**: Using existing positioning system
- **Backward compatible**: Existing banners unaffected unless grid used
- **Shopify-native**: Works within existing Liquid template system
- **Reversible**: Single commit can revert if needed

### Testing Requirements
- Verify text doesn't clip on smallest mobile screens (320px)
- Check banner readability at 90% position
- Confirm homepage hero looks correct with new positioning
- Test all three bottom positions (left, center, right)

## Deployment Plan

### Implementation Time
- **Coding**: 5 minutes (6 line changes)
- **Testing**: 15 minutes (all bottom positions)
- **Total**: 20 minutes

### Deployment Method
```bash
# Standard staging deployment
git add sections/image-banner.liquid
git commit -m "Move bottom banner text positions lower (80% → 90%)"
git push origin staging
# GitHub auto-deploys to staging in 1-2 minutes
```

### Verification Steps
1. Open staging site
2. Navigate to page with image banner
3. Select bottom-center grid position
4. Verify text appears lower than before
5. Test on mobile device (70% traffic priority)
6. Check homepage hero positioning

## Success Criteria

### Primary Goals ✅
- Banner text appears noticeably lower than current 80% position
- No over-engineering - minimal, elegant solution
- Homepage hero launch unblocked
- Works perfectly on mobile (70% traffic)

### User Satisfaction Metrics
- Text positioning meets user's visual requirements
- Simple solution aligns with "no over-engineering" request
- Homepage launch proceeds without positioning issues

## Alternative Positioning Values (If 90% Insufficient)

### If User Needs Even Lower
- **95%**: Very close to bottom edge, minimal clearance
- **85%**: Compromise between current 80% and proposed 90%

### Custom Request Handling
- Current plan provides 10% additional lowering
- If insufficient, user can request specific percentage
- Manual sliders still available for precise control

## Context Integration

### Fits Project Requirements
- ✅ **Minimal change**: Aligns with elegance over complexity philosophy
- ✅ **Mobile-first**: Respects 70% mobile traffic priority
- ✅ **Launch critical**: Unblocks homepage hero requirement
- ✅ **No over-engineering**: Simple value change, not architectural rebuild

### Strategic Alignment
- Supports homepage hero launch (conversion critical)
- Maintains focus on essential features vs aesthetic tweaks
- Allows quick deployment while other priorities (cold start fixes) remain focus

## Conclusion

**RECOMMENDED ACTION**: Implement Option 1 - Change bottom positions from 80% to 90%

This solution perfectly meets user requirements:
- ✅ Text appears lower than current positioning
- ✅ No over-engineering - simple numeric adjustment
- ✅ Homepage hero launch unblocked
- ✅ 20-minute implementation including testing
- ✅ Zero risk of breaking existing functionality

The elegant solution is often the simplest one that solves the actual problem.