# Banner Positioning Bug Debug Analysis

**Date**: September 22, 2025
**Issue**: Manual position sliders not working when grid position is set to "Use manual sliders"
**Status**: DEBUG IN PROGRESS
**Context**: Homepage hero launch requirement - BLOCKING

## Problem Summary

The custom position sliders in `image-banner.liquid` are not working when the grid position selector is set to "Use manual sliders" (empty value). This is blocking the homepage hero launch requirement.

## Current Implementation Analysis

### Code Structure
The implementation has three main parts for each block type (heading, text, buttons):

1. **Grid Position Check Logic** (Lines 156, 228, 319):
```liquid
if block.settings.position_grid != blank and block.settings.position_grid != ''
  assign use_grid = true
  # Grid positioning case logic...
endif
```

2. **Variable Assignment** (Lines 151-154, 223-226, 314-317):
```liquid
assign final_x = block.settings.x | default: 50
assign final_y = block.settings.y | default: 40
assign final_mx = block.settings.mx | default: 50
assign final_my = block.settings.my | default: 60
```

3. **CSS Variable Application** (Lines 209-212, 281-284, 372-375):
```liquid
style="--x: {{ final_x }}%;
       --y: {{ final_y }}%;
       --mx: {{ final_mx }}%;
       --my: {{ final_my }}%;"
```

### Critical Analysis of Bug Root Cause

**ROOT CAUSE IDENTIFIED**: The implementation logic is actually CORRECT. The issue is likely one of the following:

1. **`custom_position` Checkbox Not Enabled**: The custom positioning only applies when `block.settings.custom_position` is checked (lines 207, 279, 370)

2. **Default Values Overriding Sliders**: The `| default:` filters may be using fallback values instead of actual slider values

3. **Shopify Theme Editor State**: Settings may not be persisting correctly in the theme editor

## Debug Investigation Steps

### Step 1: Verify Custom Position Checkbox
**HYPOTHESIS**: The `custom_position` checkbox is unchecked, causing the banner to use normal flow instead of absolute positioning.

**EVIDENCE**:
- Lines 207, 279, 370 show the positioning only applies when `block.settings.custom_position` is true
- Without this checkbox, the element renders in normal document flow, ignoring CSS variables

### Step 2: Check Default Value Behavior
**HYPOTHESIS**: The `| default:` filter is not working as expected with Shopify's range sliders.

**EVIDENCE**:
- `assign final_x = block.settings.x | default: 50` may always use 50 if `block.settings.x` is undefined
- Range sliders in Shopify may not be properly saving values

### Step 3: Liquid Template Debugging
**HYPOTHESIS**: The grid position check condition is malfunctioning.

**EVIDENCE**:
- `block.settings.position_grid != blank and block.settings.position_grid != ''` should work for empty values
- But Shopify's select dropdown with empty string default might behave differently

## Debugging Implementation Plan

### Phase 1: Root Cause Identification (30 minutes)

1. **Add Debug Output**:
```liquid
<!-- DEBUG: Grid Position Value: {{ block.settings.position_grid | json }} -->
<!-- DEBUG: Custom Position: {{ block.settings.custom_position }} -->
<!-- DEBUG: X Value: {{ block.settings.x | json }} -->
<!-- DEBUG: Final X: {{ final_x }} -->
```

2. **Test Grid Position Conditions**:
```liquid
<!-- DEBUG: Grid Check 1: {{ block.settings.position_grid != blank }} -->
<!-- DEBUG: Grid Check 2: {{ block.settings.position_grid != '' }} -->
<!-- DEBUG: Use Grid: {{ use_grid }} -->
```

### Phase 2: Quick Fix Implementation (15 minutes)

Based on root cause, apply one of these fixes:

**Fix A: Custom Position Checkbox Issue**
- Auto-enable custom positioning when sliders are used
- Add condition: `if block.settings.x != blank or block.settings.y != blank`

**Fix B: Default Value Issue**
- Replace `| default:` with explicit null checks
- Use `{% unless block.settings.x == blank %}{{ block.settings.x }}{% else %}50{% endunless %}`

**Fix C: Grid Position Check Issue**
- Simplify condition to just `if block.settings.position_grid == blank or block.settings.position_grid == ''`
- Or use `unless block.settings.position_grid != blank`

### Phase 3: Verification (15 minutes)

1. Test all 9 grid positions work correctly
2. Test "Use manual sliders" with various slider values
3. Test switching between grid and manual modes
4. Verify both desktop and mobile positioning

## Recommended Solution Architecture

Based on the code analysis, the most likely fix is **Fix A: Custom Position Checkbox Issue**.

The elegant solution would be:
```liquid
{%- if block.settings.custom_position or (block.settings.position_grid != blank and block.settings.position_grid != '') -%}
  <div class="banner__layer" data-pos="desktop mobile"
       style="--x: {{ final_x }}%; --y: {{ final_y }}%; --mx: {{ final_mx }}%; --my: {{ final_my }}%;">
    <!-- content -->
  </div>
{%- else -%}
  <!-- normal flow content -->
{%- endif -%}
```

This would auto-enable positioning when grid is selected, allowing manual sliders to work when grid is empty.

## Expected Impact

- **Time to Fix**: 1 hour total (debug + implement + test)
- **Risk Level**: LOW (additive change, preserves existing functionality)
- **Homepage Launch**: UNBLOCKED
- **User Experience**: Intuitive positioning controls work as expected

## Next Steps

1. Deploy debug version to staging for investigation
2. Identify exact root cause from debug output
3. Implement targeted fix based on findings
4. Test all positioning modes on staging
5. Deploy to production for homepage hero launch

---

**Files to Modify**:
- `sections/image-banner.liquid` (add debug output, then fix)

**Testing Strategy**:
- Use staging site with actual banner configuration
- Test grid positions and manual sliders
- Verify both desktop (750px+) and mobile positioning